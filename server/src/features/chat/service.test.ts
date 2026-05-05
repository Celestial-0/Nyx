import { afterEach, describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { abuseInvalidFramePolicy, abusePolicies } from "@/abuse/policies";
import { abuseService } from "@/abuse/service";
import {
  creditLogs,
  deviceOneTimePrekeys,
  deviceSignedPrekeys,
  messageDelivery,
  messages,
  roomMembers,
  rooms,
  userCredits,
  userDevices,
  users,
} from "@/platform/db/schema";
import { EventBus } from "@/platform/events/bus";
import { eventSchemas } from "@/platform/events/registry";
import { authService } from "@/features/auth/service";
import { chatEventTopics } from "@/features/chat/events/topics";
import { observabilityMetrics } from "@/observability";
import { createOriginPolicy } from "@/security/origin";
import {
  chatRealtimeKeys,
  createChatRealtimeBridge,
} from "@/features/chat/realtime";
import { chatService, createChatGatewayRuntime } from "@/features/chat/service";
import { cleanupChatRedisState, withTestTransaction, type TestDb } from "@/test-utils/integration";
import { redis } from "@/platform/redis/client";
import bs58 from "bs58";

const encodeBytesBase58 = (value: Uint8Array): string => bs58.encode(value);

const originalResolveSessionFromToken = authService.resolveSessionFromToken;
const testSeed = randomUUID().slice(0, 8);

const sessionConnectionsKey = (sessionId: string) => `ws:session:${sessionId}:connections`;
const sessionSubscriptionsKey = (sessionId: string) => `ws:session:${sessionId}:subscriptions`;
const connectionSubscriptionsKey = (connectionId: string) => `ws:connection:${connectionId}:subscriptions`;
const conversationConnectionsKey = (conversationId: string) =>
  `ws:conversation:${conversationId}:connections`;

const createSocket = () => {
  const sent: Array<{ type: string; requestId?: string; data: unknown }> = [];
  const closed: Array<{ code?: number; reason?: string }> = [];

  return {
    sent,
    closed,
    socket: {
      send: (data: string) => {
        sent.push(JSON.parse(data));
      },
      close: (code?: number, reason?: string) => {
        closed.push({ code, reason });
      },
    },
  };
};

const authUser = {
  id: randomUUID(),
  walletAddress: `wallet-chat-current-${testSeed}`,
  role: "user",
  sessionId: randomUUID(),
  tokenId: randomUUID(),
  activeDeviceId: randomUUID(),
  activeDevice: {
    deviceId: "",
    fingerprint: "chatdevicecurrent",
    identityKey: {
      kty: "x25519" as const,
      publicKey: encodeBytesBase58(Buffer.from(`identity-current-${testSeed}`)),
    },
    signedPreKey: {
      keyId: randomUUID(),
      kty: "x25519" as const,
      publicKey: encodeBytesBase58(Buffer.from(`signed-current-${testSeed}`)),
      signature: encodeBytesBase58(Buffer.from(`signature-current-${testSeed}`)),
      issuedAt: new Date().toISOString(),
      expiresAt: null,
    },
    status: "active" as const,
    registeredAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    revokedAt: null,
  },
  prekeyStatus: {
    signedPreKeyRegistered: true,
    oneTimePreKeysRemaining: 10,
    oneTimePreKeysLowWatermark: false,
  },
};
authUser.activeDevice.deviceId = authUser.activeDeviceId;

const roomId = randomUUID();
const dmRoomId = randomUUID();
const otherRoomId = randomUUID();
const targetUserId = randomUUID();
const otherUserId = randomUUID();
const targetDeviceId = randomUUID();
const otherDeviceId = randomUUID();
const defaultSenderKeyEpochId = randomUUID();
const defaultSentAt = "2026-01-01T00:00:00.000Z";
const defaultDirectPreKeyId = randomUUID();
const defaultDirectOneTimePreKeyId = randomUUID();

const encodeBase58 = (label: string) => encodeBytesBase58(Buffer.from(label));

const createCiphertext = (
  label: string,
  options?: {
    conversationType?: "group" | "direct";
    recipientDeviceIds?: string[];
    senderKeyEpochId?: string;
  }
) =>
  options?.conversationType === "direct"
    ? {
        version: "1" as const,
        algorithm: "signal-prekey-message-v1" as const,
        conversationType: "direct" as const,
        senderDeviceId: authUser.activeDeviceId,
        ciphertext: encodeBase58(`cipher-${label}`),
        nonce: encodeBase58(`nonce-${label}`),
        sentAt: defaultSentAt,
        recipients: (options.recipientDeviceIds ?? [targetDeviceId]).map((deviceId) => ({
          deviceId,
          preKeyId: defaultDirectPreKeyId,
          oneTimePreKeyId: defaultDirectOneTimePreKeyId,
          encryptedMessageKey: encodeBase58(`key-${label}-${deviceId}`),
        })),
      }
    : {
        version: "1" as const,
        algorithm: "signal-sender-key-message-v1" as const,
        conversationType: "group" as const,
        senderDeviceId: authUser.activeDeviceId,
        senderKeyEpochId: options?.senderKeyEpochId ?? defaultSenderKeyEpochId,
        ciphertext: encodeBase58(`cipher-${label}`),
        nonce: encodeBase58(`nonce-${label}`),
        sentAt: defaultSentAt,
      };

const captureError = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    return error;
  }

  throw new Error("Expected promise to reject.");
};

const createEventBus = (tx: TestDb) => {
  const eventBus = new EventBus(eventSchemas);

  chatService.registerMessagePipeline({
    eventBus: eventBus as never,
    db: tx as never,
  });

  return eventBus;
};

const openAuthenticatedConnection = async ({
  tx,
  runtime,
  socket,
  eventBus,
  realtime,
  origin,
  originPolicy,
}: {
  tx: TestDb;
  runtime: ReturnType<typeof createChatGatewayRuntime>;
  socket: ReturnType<typeof createSocket>;
  eventBus: EventBus<typeof eventSchemas>;
  realtime?: ReturnType<typeof createChatRealtimeBridge>;
  origin?: string | null;
  originPolicy?: ReturnType<typeof createOriginPolicy>;
}) =>
  chatService.openConnection({
    db: tx as never,
    redis,
    jwt: {} as never,
    eventBus: eventBus as never,
    token: "good-token",
    socket: socket.socket,
    origin,
    originPolicy,
    runtime,
    realtime,
  });

const seedUsers = async (tx: TestDb) => {
  await tx.insert(users).values([
    {
      id: authUser.id,
      walletAddress: authUser.walletAddress,
      username: `chat-current-user-${testSeed}`,
    },
    {
      id: targetUserId,
      walletAddress: `wallet-chat-target-${testSeed}`,
      username: `chat-target-user-${testSeed}`,
    },
    {
      id: otherUserId,
      walletAddress: `wallet-chat-other-${testSeed}`,
      username: `chat-other-user-${testSeed}`,
    },
  ]);

  await tx.insert(userDevices).values([
    {
      id: authUser.activeDeviceId,
      userId: authUser.id,
      identityKey: authUser.activeDevice.identityKey,
      registrationMessage: "message",
      registrationSignature: "signature",
      fingerprint: authUser.activeDevice.fingerprint,
      status: "active",
      registeredAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: targetDeviceId,
      userId: targetUserId,
      identityKey: {
        kty: "x25519",
        publicKey: encodeBase58(`target-device-${testSeed}`),
      },
      registrationMessage: "message",
      registrationSignature: "signature",
      fingerprint: "targetdevice1234",
      status: "active",
      registeredAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: otherDeviceId,
      userId: otherUserId,
      identityKey: {
        kty: "x25519",
        publicKey: encodeBase58(`other-device-${testSeed}`),
      },
      registrationMessage: "message",
      registrationSignature: "signature",
      fingerprint: "otherdevice12345",
      status: "active",
      registeredAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  await tx.insert(deviceSignedPrekeys).values([
    {
      deviceId: authUser.activeDeviceId,
      keyId: authUser.activeDevice.signedPreKey.keyId,
      publicKey: authUser.activeDevice.signedPreKey.publicKey,
      signature: authUser.activeDevice.signedPreKey.signature,
      issuedAt: new Date(authUser.activeDevice.signedPreKey.issuedAt),
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      deviceId: targetDeviceId,
      keyId: randomUUID(),
      publicKey: encodeBase58(`target-signed-${testSeed}`),
      signature: encodeBase58(`target-signature-${testSeed}`),
      issuedAt: new Date(),
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      deviceId: otherDeviceId,
      keyId: randomUUID(),
      publicKey: encodeBase58(`other-signed-${testSeed}`),
      signature: encodeBase58(`other-signature-${testSeed}`),
      issuedAt: new Date(),
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  await tx.insert(deviceOneTimePrekeys).values([
    {
      deviceId: targetDeviceId,
      keyId: randomUUID(),
      publicKey: encodeBase58(`target-onetime-${testSeed}`),
      createdAt: new Date(),
    },
    {
      deviceId: otherDeviceId,
      keyId: randomUUID(),
      publicKey: encodeBase58(`other-onetime-${testSeed}`),
      createdAt: new Date(),
    },
  ]);
};

const seedGroupConversation = async ({
  tx,
  conversationId,
  memberIds,
}: {
  tx: TestDb;
  conversationId: string;
  memberIds: string[];
}) => {
  await tx.insert(rooms).values({
    id: conversationId,
    type: "group",
    createdBy: authUser.id,
  });
  await tx.insert(roomMembers).values(
    memberIds.map((userId, index) => ({
      roomId: conversationId,
      userId,
      role: index === 0 ? ("admin" as const) : ("member" as const),
    }))
  );
};

const seedDirectConversation = async ({
  tx,
  conversationId,
  memberIds,
}: {
  tx: TestDb;
  conversationId: string;
  memberIds: [string, string];
}) => {
  const directKey = [memberIds[0], memberIds[1]].sort().join(":");

  await tx.insert(rooms).values({
    id: conversationId,
    type: "direct",
    directKey,
    createdBy: memberIds[0],
  });
  await tx.insert(roomMembers).values(
    memberIds.map((userId) => ({
      roomId: conversationId,
      userId,
      role: "member" as const,
    }))
  );
};

const seedConversationMessage = async ({
  tx,
  messageId = randomUUID(),
  conversationId,
  senderId = authUser.id,
  kind = "text",
  ciphertext = createCiphertext(`message-${messageId}`),
  createdAt = new Date(),
  editedAt = null,
  deletedAt = null,
}: {
  tx: TestDb;
  messageId?: string;
  conversationId: string;
  senderId?: string;
  kind?: "text" | "image";
  ciphertext?: Record<string, unknown>;
  createdAt?: Date;
  editedAt?: Date | null;
  deletedAt?: Date | null;
}) => {
  await tx.insert(messages).values({
    id: messageId,
    roomId: conversationId,
    senderId,
    type: kind,
    content: ciphertext,
    createdAt,
    editedAt,
    deletedAt,
  });

  return {
    id: messageId,
    conversationId,
    senderId,
    kind,
    ciphertext,
    createdAt,
    editedAt,
    deletedAt,
  };
};

const seedMessageDeliveryRow = async ({
  tx,
  messageId,
  userId,
  status = "sent",
}: {
  tx: TestDb;
  messageId: string;
  userId: string;
  status?: "sent" | "delivered" | "read";
}) => {
  await tx.insert(messageDelivery).values({
    messageId,
    userId,
    status,
  });
};

const getCreditBalance = async (tx: TestDb, userId: string) => {
  const rows = await tx
    .select({
      balance: userCredits.balance,
    })
    .from(userCredits)
    .where(eq(userCredits.userId, userId))
    .limit(1);

  return rows[0]?.balance ?? null;
};

const getCreditLogEntries = async (tx: TestDb, userId: string) =>
  tx
    .select({
      change: creditLogs.change,
      reason: creditLogs.reason,
    })
    .from(creditLogs)
    .where(eq(creditLogs.userId, userId))
    .orderBy(asc(creditLogs.createdAt));

afterEach(async () => {
  authService.resolveSessionFromToken = originalResolveSessionFromToken;
  mock.restore();
  observabilityMetrics.resetForTests();
  await cleanupChatRedisState({
    sessionId: authUser.sessionId,
    conversationIds: [roomId, dmRoomId, otherRoomId],
  });
});

describe("chatService websocket gateway", () => {
  test("openConnection rejects an invalid token", async () => {
    authService.resolveSessionFromToken = async () => null;

    await withTestTransaction(async (tx) => {
      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);

      const result = await chatService.openConnection({
        db: tx as never,
        redis,
        jwt: {} as never,
        eventBus: eventBus as never,
        token: "bad-token",
        socket: socket.socket,
        runtime,
      });

      expect(result).toBeNull();
      expect(socket.closed).toEqual([{ code: 4001, reason: "Unauthorized" }]);
    });
  });

  test("openConnection rejects missing or unknown websocket origins in non-development mode", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const originPolicy = createOriginPolicy({
        nodeEnv: "production",
        corsAllowedOriginsRaw: "https://app.nyx.test",
        wsAllowedOriginsRaw: "https://app.nyx.test",
      });

      const missingOriginResult = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
        origin: null,
        originPolicy,
      });

      expect(missingOriginResult).toBeNull();
      expect(socket.closed.at(-1)).toEqual({
        code: 1008,
        reason: "Forbidden",
      });

      const wrongOriginSocket = createSocket();
      const wrongOriginResult = await openAuthenticatedConnection({
        tx,
        runtime: createChatGatewayRuntime(),
        socket: wrongOriginSocket,
        eventBus,
        origin: "https://evil.example",
        originPolicy,
      });

      expect(wrongOriginResult).toBeNull();
      expect(wrongOriginSocket.closed.at(-1)).toEqual({
        code: 1008,
        reason: "Forbidden",
      });
    });
  });

  test("openConnection authenticates and sends restored plus ready frames", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);

      const result = await chatService.openConnection({
        db: tx as never,
        redis,
        jwt: {} as never,
        eventBus: eventBus as never,
        token: "good-token",
        socket: socket.socket,
        runtime,
      });

      expect(result?.user.id).toBe(authUser.id);
      expect(socket.sent[0]).toMatchObject({
        type: "chat:subscription:restored",
        data: { conversationIds: [] },
      });
      expect(socket.sent[1]).toMatchObject({
        type: "ws:connection:ready",
        data: {
          sessionId: authUser.sessionId,
          user: {
            id: authUser.id,
            walletAddress: authUser.walletAddress,
            role: authUser.role,
          },
        },
      });
      expect(result?.connectionId).toBeString();
      expect(await redis.smembers(sessionConnectionsKey(authUser.sessionId))).toEqual([
        result!.connectionId,
      ]);
    });
  });

  test("handleIncomingMessage responds to ping with pong", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "ws:heartbeat:ping",
          requestId: "ping-1",
          data: {},
        }),
        runtime,
      });

      expect(socket.sent.at(-1)).toMatchObject({
        type: "ws:heartbeat:pong",
        requestId: "ping-1",
      });
    });
  });

  test("subscription add succeeds for an active group member", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: connection!.connectionId,
        conversationId: roomId,
        runtime,
      });

      expect(socket.sent.at(-1)).toEqual({
        type: "chat:subscription:added",
        data: {
          conversationId: roomId,
          conversationType: "group",
        },
      });
      expect(await redis.smembers(sessionSubscriptionsKey(authUser.sessionId))).toEqual([roomId]);
      expect(await redis.smembers(connectionSubscriptionsKey(connection!.connectionId))).toEqual([roomId]);
      expect(await redis.smembers(conversationConnectionsKey(roomId))).toEqual([
        connection!.connectionId,
      ]);
    });
  });

  test("subscription add succeeds for a direct conversation participant", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedDirectConversation({
        tx,
        conversationId: dmRoomId,
        memberIds: [authUser.id, targetUserId],
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: connection!.connectionId,
        conversationId: dmRoomId,
        runtime,
      });

      expect(socket.sent.at(-1)).toEqual({
        type: "chat:subscription:added",
        data: {
          conversationId: dmRoomId,
          conversationType: "direct",
        },
      });
    });
  });

  test("subscription add rejects non-members", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [targetUserId, otherUserId],
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:subscription:add",
          requestId: "sub-1",
          data: {
            conversationId: roomId,
          },
        }),
        runtime,
      });

      expect(socket.sent.at(-1)).toEqual({
        type: "ws:connection:error",
        requestId: "sub-1",
        data: {
          code: "FORBIDDEN",
          message: "You are not an active member of this conversation.",
          requestId: "sub-1",
        },
      });
    });
  });

  test("duplicate subscribe and unsubscribe are idempotent", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: connection!.connectionId,
        conversationId: roomId,
        runtime,
      });

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: connection!.connectionId,
        conversationId: roomId,
        runtime,
      });

      expect(await redis.smembers(sessionSubscriptionsKey(authUser.sessionId))).toEqual([roomId]);
      expect(runtime.connections.get(connection!.connectionId)?.subscriptions.size).toBe(1);

      await chatService.removeSubscription({
        redis,
        connectionId: connection!.connectionId,
        conversationId: roomId,
        runtime,
      });

      await chatService.removeSubscription({
        redis,
        connectionId: connection!.connectionId,
        conversationId: roomId,
        runtime,
      });

      expect(await redis.smembers(sessionSubscriptionsKey(authUser.sessionId))).toEqual([]);
      expect(runtime.connections.get(connection!.connectionId)?.subscriptions.size).toBe(0);
      expect(socket.sent.at(-1)).toEqual({
        type: "chat:subscription:removed",
        data: {
          conversationId: roomId,
        },
      });
    });
  });

  test("websocket metrics track open and close lifecycle plus active subscriptions", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const opened = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      expect(opened).not.toBeNull();
      expect(
        await observabilityMetrics.getMetricValueForTests(
          "nyx_ws_connections_active"
        )
      ).toBe(1);
      expect(
        await observabilityMetrics.getMetricValueForTests(
          "nyx_ws_connections_opened_total"
        )
      ).toBe(1);

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: opened!.connectionId,
        conversationId: roomId,
        runtime,
      });

      expect(
        await observabilityMetrics.getMetricValueForTests(
          "nyx_chat_subscriptions_active"
        )
      ).toBe(1);

      await chatService.closeConnection({
        redis,
        eventBus: eventBus as never,
        connectionId: opened!.connectionId,
        closeCode: 1000,
        runtime,
      });

      expect(
        await observabilityMetrics.getMetricValueForTests(
          "nyx_ws_connections_active"
        )
      ).toBe(0);
      expect(
        await observabilityMetrics.getMetricValueForTests(
          "nyx_chat_subscriptions_active"
        )
      ).toBe(0);
      expect(
        await observabilityMetrics.getMetricValueForTests(
          "nyx_ws_connections_closed_total",
          { code: "1000" }
        )
      ).toBe(1);
    });
  });

  test("subscription operations are rate limited independently from message send", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });
      const subject = abuseService.createUserSubject(authUser.id);

      for (let attempt = 0; attempt < abusePolicies.chatSubscriptionOps.capacity; attempt += 1) {
        await abuseService.consumePolicy({
          redis,
          policy: abusePolicies.chatSubscriptionOps,
          subject,
        });
      }

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:subscription:add",
          requestId: "sub-limited",
          data: {
            conversationId: roomId,
          },
        }),
        runtime,
      });

      expect(socket.sent.at(-1)).toMatchObject({
        type: "ws:connection:error",
        requestId: "sub-limited",
        data: {
          code: "RATE_LIMITED",
          message: "Rate limit exceeded.",
          requestId: "sub-limited",
        },
      });
      expect(
        (socket.sent.at(-1) as { data: { retryAfterMs?: number | null } }).data.retryAfterMs
      ).toBeGreaterThan(0);
    });
  });

  test("reconnect restores subscriptions for the same session", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });
      await redis.sadd(sessionSubscriptionsKey(authUser.sessionId), roomId);

      const runtime = createChatGatewayRuntime();
      const firstSocket = createSocket();
      const secondSocket = createSocket();
      const eventBus = createEventBus(tx);

      await openAuthenticatedConnection({
        tx,
        runtime,
        socket: firstSocket,
        eventBus,
      });

      const reopened = await openAuthenticatedConnection({
        tx,
        runtime,
        socket: secondSocket,
        eventBus,
      });

      expect(secondSocket.sent[0]).toEqual({
        type: "chat:subscription:restored",
        data: {
          conversationIds: [roomId],
        },
      });
      expect(await redis.smembers(connectionSubscriptionsKey(reopened!.connectionId))).toEqual([
        roomId,
      ]);
    });
  });

  test("restore drops unauthorized conversations", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: otherRoomId,
        memberIds: [targetUserId, otherUserId],
      });
      await redis.sadd(sessionSubscriptionsKey(authUser.sessionId), otherRoomId);

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);

      await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      expect(socket.sent[0]).toEqual({
        type: "chat:subscription:restored",
        data: {
          conversationIds: [],
        },
      });
      expect(await redis.smembers(sessionSubscriptionsKey(authUser.sessionId))).toEqual([]);
    });
  });

  test("closeConnection clears connection-scoped state and keeps session restore state", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: connection!.connectionId,
        conversationId: roomId,
        runtime,
      });

      await chatService.closeConnection({
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        runtime,
      });

      expect(runtime.connections.has(connection!.connectionId)).toBe(false);
      expect(await redis.smembers(connectionSubscriptionsKey(connection!.connectionId))).toEqual([]);
      expect(await redis.smembers(conversationConnectionsKey(roomId))).toEqual([]);
      expect(await redis.smembers(sessionConnectionsKey(authUser.sessionId))).toEqual([]);
      expect(await redis.smembers(sessionSubscriptionsKey(authUser.sessionId))).toEqual([roomId]);
    });
  });

  test("subscription lifecycle keeps active realtime membership state in redis", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const realtime = createChatRealtimeBridge({
        redisClient: redis,
        subscriber: redis.duplicate(),
        ownsSubscriber: true,
        nodeId: `service-presence-${testSeed}`,
      });
      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
        realtime,
      });

      expect(
        await redis.get(
          chatRealtimeKeys.connectionAlive(realtime.nodeId, connection!.connectionId)
        )
      ).toBeTruthy();

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: connection!.connectionId,
        conversationId: roomId,
        runtime,
        realtime,
      });

      expect(
        await redis.smembers(chatRealtimeKeys.conversationConnections(roomId))
      ).toEqual([`${realtime.nodeId}:${connection!.connectionId}`]);
      expect(await redis.hgetall(chatRealtimeKeys.conversationUsers(roomId))).toEqual({
        [authUser.id]: "1",
      });

      await chatService.removeSubscription({
        redis,
        connectionId: connection!.connectionId,
        conversationId: roomId,
        runtime,
        realtime,
      });

      expect(
        await redis.smembers(chatRealtimeKeys.conversationConnections(roomId))
      ).toEqual([]);
      expect(await redis.hgetall(chatRealtimeKeys.conversationUsers(roomId))).toEqual({});

      await chatService.closeConnection({
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        runtime,
        realtime,
      });

      expect(
        await redis.get(
          chatRealtimeKeys.connectionAlive(realtime.nodeId, connection!.connectionId)
        )
      ).toBeNull();

      await realtime.shutdown();
    });
  });

  test("active realtime membership counts remain until the last connection closes", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const realtime = createChatRealtimeBridge({
        redisClient: redis,
        subscriber: redis.duplicate(),
        ownsSubscriber: true,
        nodeId: `service-multi-presence-${testSeed}`,
      });
      const runtime = createChatGatewayRuntime();
      const firstSocket = createSocket();
      const secondSocket = createSocket();
      const eventBus = createEventBus(tx);
      const firstConnection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket: firstSocket,
        eventBus,
        realtime,
      });
      const secondConnection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket: secondSocket,
        eventBus,
        realtime,
      });

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: firstConnection!.connectionId,
        conversationId: roomId,
        runtime,
        realtime,
      });
      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: secondConnection!.connectionId,
        conversationId: roomId,
        runtime,
        realtime,
      });

      expect(await redis.hgetall(chatRealtimeKeys.conversationUsers(roomId))).toEqual({
        [authUser.id]: "2",
      });

      await chatService.closeConnection({
        redis,
        eventBus: eventBus as never,
        connectionId: firstConnection!.connectionId,
        runtime,
        realtime,
      });

      expect(await redis.hgetall(chatRealtimeKeys.conversationUsers(roomId))).toEqual({
        [authUser.id]: "1",
      });

      await chatService.closeConnection({
        redis,
        eventBus: eventBus as never,
        connectionId: secondConnection!.connectionId,
        runtime,
        realtime,
      });

      expect(await redis.hgetall(chatRealtimeKeys.conversationUsers(roomId))).toEqual({});

      await realtime.shutdown();
    });
  });

  test("fanout only reaches sockets subscribed to the matching conversation", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });
      await seedGroupConversation({
        tx,
        conversationId: otherRoomId,
        memberIds: [authUser.id, otherUserId],
      });

      const runtime = createChatGatewayRuntime();
      const eventBus = createEventBus(tx);
      chatService.registerEventFanout({
        eventBus: eventBus as never,
        runtime,
      });

      const subscribedSocket = createSocket();
      const unsubscribedSocket = createSocket();
      const subscribedConnection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket: subscribedSocket,
        eventBus,
      });
      const otherConnection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket: unsubscribedSocket,
        eventBus,
      });

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: subscribedConnection!.connectionId,
        conversationId: roomId,
        runtime,
      });
      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: otherConnection!.connectionId,
        conversationId: otherRoomId,
        runtime,
      });

      await eventBus.emit(chatEventTopics.messageCreated, {
        messageId: randomUUID(),
        conversationId: roomId,
        senderId: authUser.id,
        kind: "text",
        ciphertext: createCiphertext("fanout-payload"),
        createdAt: new Date().toISOString(),
      });

      expect(subscribedSocket.sent.at(-1)).toMatchObject({
        type: "chat:message:created",
        data: {
          conversationId: roomId,
          senderId: authUser.id,
          kind: "text",
        },
      });
      expect(unsubscribedSocket.sent.at(-1)).toEqual({
        type: "chat:subscription:added",
        data: {
          conversationId: otherRoomId,
          conversationType: "group",
        },
      });
    });
  });

  test("message send for a subscribed group member persists and acknowledges", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const submittedEvents: Array<Record<string, unknown>> = [];
      const createdEvents: Array<Record<string, unknown>> = [];

      eventBus.on(chatEventTopics.messageSubmitted, async (payload) => {
        submittedEvents.push(payload as Record<string, unknown>);
      });
      eventBus.on(chatEventTopics.messageCreated, async (payload) => {
        createdEvents.push(payload as Record<string, unknown>);
      });

      chatService.registerEventFanout({
        eventBus: eventBus as never,
        runtime,
      });

      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: connection!.connectionId,
        conversationId: roomId,
        runtime,
      });

      const messageId = randomUUID();
      const clientTimestamp = new Date().toISOString();
      const ciphertext = createCiphertext("group-message");

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:message:send",
          requestId: "send-group-1",
          data: {
            messageId,
            conversationId: roomId,
            kind: "text",
            ciphertext,
            clientTimestamp,
          },
        }),
        runtime,
      });

      const storedMessages = await tx
        .select({
          id: messages.id,
          roomId: messages.roomId,
          senderId: messages.senderId,
          type: messages.type,
          content: messages.content,
        })
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      const updatedRooms = await tx
        .select({
          lastMessageId: rooms.lastMessageId,
          lastMessageAt: rooms.lastMessageAt,
        })
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);
      const deliveryRows = await tx
        .select({
          messageId: messageDelivery.messageId,
          userId: messageDelivery.userId,
          status: messageDelivery.status,
        })
        .from(messageDelivery)
        .where(eq(messageDelivery.messageId, messageId));
      const balance = await getCreditBalance(tx, authUser.id);
      const creditEntries = await getCreditLogEntries(tx, authUser.id);

      expect(storedMessages[0]).toEqual({
        id: messageId,
        roomId,
        senderId: authUser.id,
        type: "text",
        content: ciphertext,
      });
      expect(updatedRooms[0]?.lastMessageId).toBe(messageId);
      expect(updatedRooms[0]?.lastMessageAt).toBeTruthy();
      expect(deliveryRows).toEqual([
        {
          messageId,
          userId: targetUserId,
          status: "sent",
        },
      ]);
      expect(submittedEvents).toHaveLength(1);
      expect(submittedEvents[0]).toMatchObject({
        messageId,
        conversationId: roomId,
        senderId: authUser.id,
        kind: "text",
        ciphertext,
        clientTimestamp,
      });
      expect(createdEvents).toHaveLength(1);
      expect(createdEvents[0]).toMatchObject({
        messageId,
        conversationId: roomId,
        senderId: authUser.id,
        kind: "text",
        ciphertext,
      });
      expect(socket.sent.findLast((frame) => frame.type === "chat:message:created")).toMatchObject({
        type: "chat:message:created",
        data: {
          messageId,
          conversationId: roomId,
          senderId: authUser.id,
          kind: "text",
          ciphertext,
        },
      });
      expect(socket.sent.findLast((frame) => frame.type === "chat:message:accepted")).toMatchObject({
        type: "chat:message:accepted",
        requestId: "send-group-1",
        data: {
          messageId,
          conversationId: roomId,
        },
      });
      expect(balance).toBe(148);
      expect(creditEntries).toEqual([
        { change: 150, reason: "initial_grant" },
        { change: -2, reason: "message_send" },
      ]);
    });
  });

  test("websocket send and rejection metrics are recorded for message flows", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: connection!.connectionId,
        conversationId: roomId,
        runtime,
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:message:send",
          requestId: "metric-send-1",
          data: {
            messageId: randomUUID(),
            conversationId: roomId,
            kind: "text",
            ciphertext: createCiphertext("metric-send"),
            clientTimestamp: new Date().toISOString(),
          },
        }),
        runtime,
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:message:send",
          requestId: "metric-send-2",
          data: {
            conversationId: roomId,
          },
        }),
        runtime,
      });

      expect(
        await observabilityMetrics.getMetricValueForTests(
          "nyx_ws_messages_in_total",
          { type: "chat:message:send" }
        )
      ).toBe(2);
      expect(
        await observabilityMetrics.getMetricValueForTests(
          "nyx_ws_messages_out_total",
          { type: "chat:message:accepted" }
        )
      ).toBe(1);
      expect(
        await observabilityMetrics.getMetricValueForTests(
          "nyx_ws_message_rejections_total",
          { type: "chat:message:rejected", code: "INVALID_MESSAGE" }
        )
      ).toBe(1);
    });
  });

  test("message send for a direct conversation participant persists and acknowledges", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedDirectConversation({
        tx,
        conversationId: dmRoomId,
        memberIds: [authUser.id, targetUserId],
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      const messageId = randomUUID();

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:message:send",
          requestId: "send-dm-1",
          data: {
            messageId,
            conversationId: dmRoomId,
            kind: "image",
            ciphertext: createCiphertext("dm-image", {
              conversationType: "direct",
            }),
            clientTimestamp: new Date().toISOString(),
          },
        }),
        runtime,
      });

      const storedMessages = await tx
        .select({
          id: messages.id,
          roomId: messages.roomId,
          senderId: messages.senderId,
          type: messages.type,
        })
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);
      const deliveryRows = await tx
        .select({
          messageId: messageDelivery.messageId,
          userId: messageDelivery.userId,
          status: messageDelivery.status,
        })
        .from(messageDelivery)
        .where(eq(messageDelivery.messageId, messageId));

      expect(storedMessages[0]).toEqual({
        id: messageId,
        roomId: dmRoomId,
        senderId: authUser.id,
        type: "image",
      });
      expect(deliveryRows).toEqual([
        {
          messageId,
          userId: targetUserId,
          status: "sent",
        },
      ]);
      expect(socket.sent.findLast((frame) => frame.type === "chat:message:accepted")).toMatchObject({
        type: "chat:message:accepted",
        requestId: "send-dm-1",
        data: {
          messageId,
          conversationId: dmRoomId,
        },
      });
    });
  });

  test("delivery ack updates recipient status and notifies subscribed sender sessions", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedDirectConversation({
        tx,
        conversationId: dmRoomId,
        memberIds: [authUser.id, targetUserId],
      });

      const runtime = createChatGatewayRuntime();
      const senderSocket = createSocket();
      const senderSecondSocket = createSocket();
      const recipientSocket = createSocket();
      const eventBus = createEventBus(tx);
      chatService.registerEventFanout({
        eventBus: eventBus as never,
        runtime,
      });
      const senderConnection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket: senderSocket,
        eventBus,
      });
      const senderSecondConnection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket: senderSecondSocket,
        eventBus,
      });

      authService.resolveSessionFromToken = async () =>
        ({
          ...authUser,
          id: targetUserId,
          walletAddress: `wallet-chat-target-${testSeed}`,
          sessionId: randomUUID(),
        }) as never;

      const recipientConnection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket: recipientSocket,
        eventBus,
      });

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: senderConnection!.connectionId,
        conversationId: dmRoomId,
        runtime,
      });
      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: senderSecondConnection!.connectionId,
        conversationId: dmRoomId,
        runtime,
      });
      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: recipientConnection!.connectionId,
        conversationId: dmRoomId,
        runtime,
      });

      authService.resolveSessionFromToken = async () => authUser as never;

      const sentMessage = await seedConversationMessage({
        tx,
        conversationId: dmRoomId,
        senderId: authUser.id,
      });
      await seedMessageDeliveryRow({
        tx,
        messageId: sentMessage.id,
        userId: targetUserId,
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: recipientConnection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:delivery:ack",
          requestId: "ack-delivered-1",
          data: {
            messageId: sentMessage.id,
            conversationId: dmRoomId,
            status: "delivered",
            clientTimestamp: new Date().toISOString(),
          },
        }),
        runtime,
      });

      const deliveryRows = await tx
        .select({
          status: messageDelivery.status,
        })
        .from(messageDelivery)
        .where(
          and(
            eq(messageDelivery.messageId, sentMessage.id),
            eq(messageDelivery.userId, targetUserId)
          )
        )
        .limit(1);

      expect(deliveryRows[0]?.status).toBe("delivered");
      expect(senderSocket.sent.findLast((frame) => frame.type === "chat:delivery:updated")).toMatchObject({
        type: "chat:delivery:updated",
        data: {
          messageId: sentMessage.id,
          conversationId: dmRoomId,
          userId: targetUserId,
          status: "delivered",
        },
      });
      expect(
        senderSecondSocket.sent.findLast((frame) => frame.type === "chat:delivery:updated")
      ).toMatchObject({
        type: "chat:delivery:updated",
        data: {
          messageId: sentMessage.id,
          conversationId: dmRoomId,
          userId: targetUserId,
          status: "delivered",
        },
      });
      expect(
        recipientSocket.sent.findLast((frame) => frame.type === "chat:delivery:updated")
      ).toBeUndefined();
    });
  });

  test("read ack advances from sent to read and emits delivered then read", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedDirectConversation({
        tx,
        conversationId: dmRoomId,
        memberIds: [authUser.id, targetUserId],
      });

      const runtime = createChatGatewayRuntime();
      const senderSocket = createSocket();
      const recipientSocket = createSocket();
      const eventBus = createEventBus(tx);
      chatService.registerEventFanout({
        eventBus: eventBus as never,
        runtime,
      });
      const senderConnection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket: senderSocket,
        eventBus,
      });

      authService.resolveSessionFromToken = async () =>
        ({
          ...authUser,
          id: targetUserId,
          walletAddress: `wallet-chat-target-${testSeed}`,
          sessionId: randomUUID(),
        }) as never;

      const recipientConnection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket: recipientSocket,
        eventBus,
      });

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: senderConnection!.connectionId,
        conversationId: dmRoomId,
        runtime,
      });
      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: recipientConnection!.connectionId,
        conversationId: dmRoomId,
        runtime,
      });

      authService.resolveSessionFromToken = async () => authUser as never;

      const sentMessage = await seedConversationMessage({
        tx,
        conversationId: dmRoomId,
        senderId: authUser.id,
      });
      await seedMessageDeliveryRow({
        tx,
        messageId: sentMessage.id,
        userId: targetUserId,
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: recipientConnection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:delivery:ack",
          requestId: "ack-read-1",
          data: {
            messageId: sentMessage.id,
            conversationId: dmRoomId,
            status: "read",
            clientTimestamp: new Date().toISOString(),
          },
        }),
        runtime,
      });

      const deliveryRows = await tx
        .select({
          status: messageDelivery.status,
        })
        .from(messageDelivery)
        .where(
          and(
            eq(messageDelivery.messageId, sentMessage.id),
            eq(messageDelivery.userId, targetUserId)
          )
        )
        .limit(1);

      const deliveryUpdates = senderSocket.sent.filter(
        (frame) => frame.type === "chat:delivery:updated"
      );

      expect(deliveryRows[0]?.status).toBe("read");
      expect(deliveryUpdates.at(-2)).toMatchObject({
        type: "chat:delivery:updated",
        data: {
          messageId: sentMessage.id,
          conversationId: dmRoomId,
          userId: targetUserId,
          status: "delivered",
        },
      });
      expect(deliveryUpdates.at(-1)).toMatchObject({
        type: "chat:delivery:updated",
        data: {
          messageId: sentMessage.id,
          conversationId: dmRoomId,
          userId: targetUserId,
          status: "read",
        },
      });
    });
  });

  test("sender cannot acknowledge their own message", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      const sentMessage = await seedConversationMessage({
        tx,
        conversationId: roomId,
        senderId: authUser.id,
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:delivery:ack",
          requestId: "ack-self-1",
          data: {
            messageId: sentMessage.id,
            conversationId: roomId,
            status: "delivered",
            clientTimestamp: new Date().toISOString(),
          },
        }),
        runtime,
      });

      expect(socket.sent.at(-1)).toEqual({
        type: "ws:connection:error",
        requestId: "ack-self-1",
        data: {
          code: "BAD_REQUEST",
          message: "Sender cannot acknowledge their own message.",
          requestId: "ack-self-1",
        },
      });
    });
  });

  test("pending sent deliveries replay on subscription add without creating duplicate rows", async () => {
    authService.resolveSessionFromToken = async () =>
      ({
        ...authUser,
        id: targetUserId,
        walletAddress: `wallet-chat-target-${testSeed}`,
        sessionId: randomUUID(),
      }) as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const pendingMessage = await seedConversationMessage({
        tx,
        conversationId: roomId,
        senderId: authUser.id,
        ciphertext: createCiphertext("pending-replay"),
      });
      await seedMessageDeliveryRow({
        tx,
        messageId: pendingMessage.id,
        userId: targetUserId,
        status: "sent",
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      await chatService.addSubscription({ eventBus: eventBus as never,
        db: tx as never,
        redis,
        connectionId: connection!.connectionId,
        conversationId: roomId,
        runtime,
      });

      const replayedMessage = socket.sent.findLast(
        (frame) =>
          frame.type === "chat:message:created" &&
          (frame.data as { messageId?: string }).messageId === pendingMessage.id
      );
      const deliveryRows = await tx
        .select({
          messageId: messageDelivery.messageId,
          userId: messageDelivery.userId,
          status: messageDelivery.status,
        })
        .from(messageDelivery)
        .where(eq(messageDelivery.messageId, pendingMessage.id));

      expect(replayedMessage).toMatchObject({
        type: "chat:message:created",
        data: {
          messageId: pendingMessage.id,
          conversationId: roomId,
          senderId: authUser.id,
          ciphertext: createCiphertext("pending-replay"),
        },
      });
      expect(deliveryRows).toEqual([
        {
          messageId: pendingMessage.id,
          userId: targetUserId,
          status: "sent",
        },
      ]);
    });
  });

  test("pending sent deliveries replay on reconnect restore", async () => {
    const recipientSessionId = randomUUID();
    authService.resolveSessionFromToken = async () =>
      ({
        ...authUser,
        id: targetUserId,
        walletAddress: `wallet-chat-target-${testSeed}`,
        sessionId: recipientSessionId,
      }) as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const pendingMessage = await seedConversationMessage({
        tx,
        conversationId: roomId,
        senderId: authUser.id,
        ciphertext: createCiphertext("pending-restore"),
      });
      await seedMessageDeliveryRow({
        tx,
        messageId: pendingMessage.id,
        userId: targetUserId,
        status: "sent",
      });
      await redis.sadd(sessionSubscriptionsKey(recipientSessionId), roomId);

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);

      await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      const replayedMessage = socket.sent.findLast(
        (frame) =>
          frame.type === "chat:message:created" &&
          (frame.data as { messageId?: string }).messageId === pendingMessage.id
      );

      expect(replayedMessage).toMatchObject({
        type: "chat:message:created",
        data: {
          messageId: pendingMessage.id,
          conversationId: roomId,
          senderId: authUser.id,
          ciphertext: createCiphertext("pending-restore"),
        },
      });
    });
  });

  test("message send rejects non-members", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [targetUserId, otherUserId],
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      const messageId = randomUUID();

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:message:send",
          requestId: "send-forbidden-1",
          data: {
            messageId,
            conversationId: roomId,
            kind: "text",
            ciphertext: createCiphertext("forbidden"),
            clientTimestamp: new Date().toISOString(),
          },
        }),
        runtime,
      });

      expect(await getCreditBalance(tx, authUser.id)).toBeNull();

      expect(socket.sent.at(-1)).toEqual({
        type: "chat:message:rejected",
        requestId: "send-forbidden-1",
        data: {
          code: "FORBIDDEN",
          message: "You are not an active member of this conversation.",
          requestId: "send-forbidden-1",
          messageId,
          conversationId: roomId,
          retryAfterMs: null,
        },
      });
    });
  });

  test("message send rejects malformed payloads without closing the socket", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:message:send",
          requestId: "send-bad-1",
          data: {},
        }),
        runtime,
      });

      expect(socket.sent.at(-1)).toEqual({
        type: "chat:message:rejected",
        requestId: "send-bad-1",
        data: {
          code: "INVALID_MESSAGE",
          message: "Invalid message send payload.",
          requestId: "send-bad-1",
          messageId: null,
          conversationId: null,
          retryAfterMs: null,
        },
      });
      expect(socket.closed).toEqual([]);
    });
  });

  test("duplicate message ids are rejected deterministically", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      const messageId = randomUUID();
      const basePayload = {
        messageId,
        conversationId: roomId,
        kind: "text",
        ciphertext: createCiphertext("dup-message"),
        clientTimestamp: new Date().toISOString(),
      };

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:message:send",
          requestId: "send-dup-1",
          data: basePayload,
        }),
        runtime,
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:message:send",
          requestId: "send-dup-2",
          data: basePayload,
        }),
        runtime,
      });

      expect(await getCreditBalance(tx, authUser.id)).toBe(148);

      expect(socket.sent.findLast((frame) => frame.requestId === "send-dup-2")).toEqual({
        type: "chat:message:rejected",
        requestId: "send-dup-2",
        data: {
          code: "CONFLICT",
          message: "Message already exists for this messageId.",
          requestId: "send-dup-2",
          messageId,
          conversationId: roomId,
          retryAfterMs: null,
        },
      });
    });
  });

  test("message send rate limiting returns retryAfterMs", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const realtime = createChatRealtimeBridge({
        redisClient: redis,
        subscriber: redis.duplicate(),
        ownsSubscriber: true,
        nodeId: `service-rate-limit-${testSeed}`,
        rateLimitCapacity: 1,
        rateLimitRefillPerSecond: 0.0001,
      });
      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
        realtime,
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:message:send",
          requestId: "rate-ok",
          data: {
            messageId: randomUUID(),
            conversationId: roomId,
            kind: "text",
            ciphertext: createCiphertext("rate-ok"),
            clientTimestamp: new Date().toISOString(),
          },
        }),
        runtime,
        realtime,
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:message:send",
          requestId: "rate-limited",
          data: {
            messageId: randomUUID(),
            conversationId: roomId,
            kind: "text",
            ciphertext: createCiphertext("rate-limited"),
            clientTimestamp: new Date().toISOString(),
          },
        }),
        runtime,
        realtime,
      });

      expect(await getCreditBalance(tx, authUser.id)).toBe(148);

      expect(socket.sent.findLast((frame) => frame.requestId === "rate-limited")).toMatchObject({
        type: "chat:message:rejected",
        requestId: "rate-limited",
        data: {
          code: "RATE_LIMITED",
          message: "Message send rate limit exceeded.",
          requestId: "rate-limited",
          conversationId: roomId,
        },
      });
      expect(
        (socket.sent.findLast((frame) => frame.requestId === "rate-limited") as {
          data: { retryAfterMs?: number | null };
        }).data.retryAfterMs
      ).toBeGreaterThan(0);

      await realtime.shutdown();
    });
  });

  test("dedupe claims are released after internal pipeline failures", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const realtime = createChatRealtimeBridge({
        redisClient: redis,
        subscriber: redis.duplicate(),
        ownsSubscriber: true,
        nodeId: `service-dedupe-release-${testSeed}`,
      });
      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = new EventBus(eventSchemas);
      eventBus.on(chatEventTopics.messageSubmitted, async () => {
        throw new Error("simulated pipeline failure");
      });

      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
        realtime,
      });

      const messageId = randomUUID();
      const baseFrame = {
        type: "chat:message:send",
        data: {
          messageId,
          conversationId: roomId,
          kind: "text",
          ciphertext: createCiphertext("pipeline-failure"),
          clientTimestamp: new Date().toISOString(),
        },
      };

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          ...baseFrame,
          requestId: "pipeline-fail-1",
        }),
        runtime,
        realtime,
      });

      expect(await redis.get(chatRealtimeKeys.messageDedupe(messageId))).toBeNull();
      expect(await getCreditBalance(tx, authUser.id)).toBeNull();
      expect(socket.sent.findLast((frame) => frame.requestId === "pipeline-fail-1")).toEqual({
        type: "chat:message:rejected",
        requestId: "pipeline-fail-1",
        data: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process the message.",
          requestId: "pipeline-fail-1",
          messageId,
          conversationId: roomId,
          retryAfterMs: null,
        },
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          ...baseFrame,
          requestId: "pipeline-fail-2",
        }),
        runtime,
        realtime,
      });

      expect(socket.sent.findLast((frame) => frame.requestId === "pipeline-fail-2")).toEqual({
        type: "chat:message:rejected",
        requestId: "pipeline-fail-2",
        data: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process the message.",
          requestId: "pipeline-fail-2",
          messageId,
          conversationId: roomId,
          retryAfterMs: null,
        },
      });

      await realtime.shutdown();
    });
  });

  test("malformed JSON and unknown types return websocket errors", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: "{invalid",
        runtime,
      });

      expect(socket.sent.at(-1)).toEqual({
        type: "ws:connection:error",
        data: {
          code: "INVALID_JSON",
          message: "Malformed JSON payload.",
          requestId: null,
        },
      });

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:unknown:send",
          requestId: "bad-type",
          data: {},
        }),
        runtime,
      });

      expect(socket.sent.at(-1)).toEqual({
        type: "ws:connection:error",
        requestId: "bad-type",
        data: {
          code: "INVALID_MESSAGE_TYPE",
          message: 'Unsupported websocket message type "chat:unknown:send".',
          requestId: "bad-type",
        },
      });
    });
  });

  test("invalid websocket frame bursts close the socket and block reconnect during cooldown", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      for (let attempt = 0; attempt < abuseInvalidFramePolicy.threshold; attempt += 1) {
        await chatService.handleIncomingMessage({
          db: tx as never,
          redis,
          eventBus: eventBus as never,
          connectionId: connection!.connectionId,
          rawMessage: "{invalid",
          runtime,
        });
      }

      expect(socket.closed.at(-1)).toEqual({
        code: 4008,
        reason: "Rate limited",
      });

      const reconnectSocket = createSocket();
      const reconnectRuntime = createChatGatewayRuntime();
      const reopened = await chatService.openConnection({
        db: tx as never,
        redis,
        jwt: {} as never,
        eventBus: eventBus as never,
        token: "good-token",
        socket: reconnectSocket.socket,
        runtime: reconnectRuntime,
      });

      expect(reopened).toBeNull();
      expect(reconnectSocket.closed).toEqual([{ code: 4008, reason: "Rate limited" }]);
    });
  });
});

describe("chatService history", () => {
  test("group room member can fetch newest-first history with pagination", async () => {
    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const now = Date.now();

      const oldest = await seedConversationMessage({
        tx,
        conversationId: roomId,
        senderId: targetUserId,
        createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
      });
      const middle = await seedConversationMessage({
        tx,
        conversationId: roomId,
        senderId: authUser.id,
        kind: "image",
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      });
      const newest = await seedConversationMessage({
        tx,
        conversationId: roomId,
        senderId: authUser.id,
        createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
      });

      const firstPage = await chatService.getConversationHistory({
        db: tx as never,
        conversationId: roomId,
        userId: authUser.id,
        query: {
          limit: 2,
        },
      });

      expect(firstPage.messages.map((message) => message.id)).toEqual([newest.id, middle.id]);
      expect(firstPage.pageInfo).toEqual({
        limit: 2,
        hasMore: true,
        nextBeforeMessageId: middle.id,
      });

      const secondPage = await chatService.getConversationHistory({
        db: tx as never,
        conversationId: roomId,
        userId: authUser.id,
        query: {
          limit: 2,
          beforeMessageId: middle.id,
        },
      });

      expect(secondPage.messages.map((message) => message.id)).toEqual([oldest.id]);
      expect(secondPage.pageInfo).toEqual({
        limit: 2,
        hasMore: false,
        nextBeforeMessageId: null,
      });
    });
  });

  test("dm participant can fetch history", async () => {
    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedDirectConversation({
        tx,
        conversationId: dmRoomId,
        memberIds: [authUser.id, targetUserId],
      });

      const dmMessage = await seedConversationMessage({
        tx,
        conversationId: dmRoomId,
        senderId: targetUserId,
      });

      const history = await chatService.getConversationHistory({
        db: tx as never,
        conversationId: dmRoomId,
        userId: authUser.id,
        query: {
          limit: 50,
        },
      });

      expect(history.messages).toHaveLength(1);
      expect(history.messages[0]).toMatchObject({
        id: dmMessage.id,
        conversationId: dmRoomId,
        senderId: targetUserId,
      });
    });
  });

  test("non-members cannot fetch history", async () => {
    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [targetUserId, otherUserId],
      });

      const error = await captureError(() =>
        chatService.getConversationHistory({
          db: tx as never,
          conversationId: roomId,
          userId: authUser.id,
          query: {
            limit: 50,
          },
        })
      );

      expect(error).toMatchObject({
        code: "FORBIDDEN",
      });
    });
  });

  test("empty conversations return an empty history page", async () => {
    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const history = await chatService.getConversationHistory({
        db: tx as never,
        conversationId: roomId,
        userId: authUser.id,
        query: {
          limit: 50,
        },
      });

      expect(history).toEqual({
        messages: [],
        pageInfo: {
          limit: 50,
          hasMore: false,
          nextBeforeMessageId: null,
        },
      });
    });
  });

  test("invalid cursors and cross-conversation cursors are rejected", async () => {
    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });
      await seedGroupConversation({
        tx,
        conversationId: otherRoomId,
        memberIds: [authUser.id, otherUserId],
      });

      const otherConversationMessage = await seedConversationMessage({
        tx,
        conversationId: otherRoomId,
        senderId: otherUserId,
      });

      const invalidCursorError = await captureError(() =>
        chatService.getConversationHistory({
          db: tx as never,
          conversationId: roomId,
          userId: authUser.id,
          query: {
            limit: 50,
            beforeMessageId: randomUUID(),
          },
        })
      );

      expect(invalidCursorError).toMatchObject({
        code: "BAD_REQUEST",
      });

      const crossConversationCursorError = await captureError(() =>
        chatService.getConversationHistory({
          db: tx as never,
          conversationId: roomId,
          userId: authUser.id,
          query: {
            limit: 50,
            beforeMessageId: otherConversationMessage.id,
          },
        })
      );

      expect(crossConversationCursorError).toMatchObject({
        code: "BAD_REQUEST",
        message: "History cursor does not belong to this conversation.",
      });
    });
  });

  test("deleted and expired messages are excluded from history", async () => {
    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const visibleMessage = await seedConversationMessage({
        tx,
        conversationId: roomId,
        createdAt: new Date(),
      });
      await seedConversationMessage({
        tx,
        conversationId: roomId,
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      });
      await seedConversationMessage({
        tx,
        conversationId: roomId,
        createdAt: new Date(),
        deletedAt: new Date(),
      });

      const history = await chatService.getConversationHistory({
        db: tx as never,
        conversationId: roomId,
        userId: authUser.id,
        query: {
          limit: 50,
        },
      });

      expect(history.messages.map((message) => message.id)).toEqual([visibleMessage.id]);
      expect(history.messages[0]).not.toHaveProperty("text");
    });
  });

  test("successful phase 7 send is retrievable and expired messages are pruned on write", async () => {
    authService.resolveSessionFromToken = async () => authUser as never;

    await withTestTransaction(async (tx) => {
      await seedUsers(tx);
      await seedGroupConversation({
        tx,
        conversationId: roomId,
        memberIds: [authUser.id, targetUserId],
      });

      const expiredMessage = await seedConversationMessage({
        tx,
        conversationId: roomId,
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      });

      const runtime = createChatGatewayRuntime();
      const socket = createSocket();
      const eventBus = createEventBus(tx);
      const connection = await openAuthenticatedConnection({
        tx,
        runtime,
        socket,
        eventBus,
      });

      const messageId = randomUUID();
      const ciphertext = createCiphertext("phase-8-readback");

      await chatService.handleIncomingMessage({
        db: tx as never,
        redis,
        eventBus: eventBus as never,
        connectionId: connection!.connectionId,
        rawMessage: JSON.stringify({
          type: "chat:message:send",
          requestId: "phase8-history-1",
          data: {
            messageId,
            conversationId: roomId,
            kind: "text",
            ciphertext,
            clientTimestamp: new Date().toISOString(),
          },
        }),
        runtime,
      });

      const history = await chatService.getConversationHistory({
        db: tx as never,
        conversationId: roomId,
        userId: authUser.id,
        query: {
          limit: 50,
        },
      });

      const expiredRows = await tx
        .select({
          id: messages.id,
        })
        .from(messages)
        .where(eq(messages.id, expiredMessage.id));

      expect(history.messages[0]).toMatchObject({
        id: messageId,
        conversationId: roomId,
        senderId: authUser.id,
        kind: "text",
        ciphertext,
      });
      expect(history.messages.map((message) => message.id)).not.toContain(expiredMessage.id);
      expect(expiredRows).toEqual([]);
    });
  });
});
