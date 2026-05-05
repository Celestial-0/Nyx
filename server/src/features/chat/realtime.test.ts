import { afterEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { EventBus } from "@/platform/events/bus";
import { eventSchemas } from "@/platform/events/registry";
import { chatEventTopics } from "@/features/chat/events/topics";
import { observabilityMetrics } from "@/observability";
import {
  chatRealtimeKeys,
  createChatRealtimeBridge,
} from "@/features/chat/realtime";
import { createChatGatewayRuntime } from "@/features/chat/service";
import type { ChatConnectionState } from "@/features/chat/types";
import { redis } from "@/platform/redis/client";
import { cleanupChatRedisState } from "@/test-utils/integration";
import bs58 from "bs58";

const encodeBase58 = (value: Uint8Array): string => bs58.encode(value);

const decodeBase58 = (value: string): Uint8Array => bs58.decode(value);

const createSocket = () => {
  const sent: Array<{ type: string; data: unknown }> = [];

  return {
    sent,
    socket: {
      send: (data: string) => {
        sent.push(JSON.parse(data));
      },
      close: () => {},
    },
  };
};

const waitForRealtimeSettle = (ms = 50) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const waitForBridgeReady = async ({
  bridge,
  timeoutMs = 6000,
}: {
  bridge: ReturnType<typeof createChatRealtimeBridge>;
  timeoutMs?: number;
}) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const readiness = bridge.getReadinessState();

    if (readiness.isConnected && readiness.isSubscribed) {
      return;
    }

    await waitForRealtimeSettle(20);
  }

  throw new Error("Timed out waiting for realtime bridge readiness");
};

const waitForFrames = async ({
  sent,
  count,
  timeoutMs = 1800,
}: {
  sent: Array<{ type: string; data: unknown }>;
  count: number;
  timeoutMs?: number;
}) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (sent.length >= count) {
      return;
    }

    await waitForRealtimeSettle(20);
  }

  throw new Error("Timed out waiting for websocket frames");
};

const emitUntilFrames = async ({
  emit,
  sent,
  count,
  attempts = 3,
  timeoutMs = 700,
}: {
  emit: () => Promise<void>;
  sent: Array<{ type: string; data: unknown }>;
  count: number;
  attempts?: number;
  timeoutMs?: number;
}) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await emit();

    try {
      await waitForFrames({
        sent,
        count,
        timeoutMs,
      });
      return;
    } catch (error) {
      if (attempt === attempts - 1) {
        throw error;
      }
    }

    await waitForRealtimeSettle(100);
  }
};

const createConnection = ({
  connectionId = randomUUID(),
  userId = randomUUID(),
  sessionId = randomUUID(),
} = {}) => {
  const socket = createSocket();
  const connection: ChatConnectionState = {
    connectionId,
    socket: socket.socket,
    user: {
      id: userId,
      walletAddress: `wallet-${userId}`,
      role: "user",
      sessionId,
      tokenId: randomUUID(),
      activeDeviceId: randomUUID(),
      activeDevice: {
        deviceId: randomUUID(),
        fingerprint: "realtimedevice12",
        identityKey: {
          kty: "x25519" as const,
          publicKey: encodeBase58(Buffer.from(`identity-${userId}`)),
        },
        signedPreKey: {
          keyId: randomUUID(),
          kty: "x25519" as const,
          publicKey: encodeBase58(Buffer.from(`signed-${userId}`)),
          signature: encodeBase58(Buffer.from(`signature-${userId}`)),
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
    },
    subscriptions: new Set<string>(),
    sharePresence: true,
  };
  connection.user.activeDevice.deviceId = connection.user.activeDeviceId;

  return {
    socket,
    connection,
  };
};

afterEach(async () => {
  observabilityMetrics.resetForTests();
  await cleanupChatRedisState({
    sessionId: "phase9-realtime-tests",
    conversationIds: [],
  });
});

describe("chat realtime bridge", () => {
  test("conversation events published on one node reach subscribed sockets on another node only once", async () => {
    const testId = randomUUID().slice(0, 8);
    const bridgeA = createChatRealtimeBridge({
      redisClient: redis,
      subscriber: redis.duplicate(),
      ownsSubscriber: true,
      nodeId: `phase9-node-a-${testId}`,
    });
    const bridgeB = createChatRealtimeBridge({
      redisClient: redis,
      subscriber: redis.duplicate(),
      ownsSubscriber: true,
      nodeId: `phase9-node-b-${testId}`,
    });
    const runtimeA = createChatGatewayRuntime();
    const runtimeB = createChatGatewayRuntime();
    const eventBusA = new EventBus(eventSchemas);
    const eventBusB = new EventBus(eventSchemas);
    const conversationId = randomUUID();
    const origin = createConnection();
    const remote = createConnection();

    runtimeA.connections.set(origin.connection.connectionId, origin.connection);
    runtimeA.conversationConnections.set(conversationId, new Set([origin.connection.connectionId]));
    origin.connection.subscriptions.add(conversationId);
    runtimeB.connections.set(remote.connection.connectionId, remote.connection);
    runtimeB.conversationConnections.set(conversationId, new Set([remote.connection.connectionId]));
    remote.connection.subscriptions.add(conversationId);

    await bridgeA.touchConnection({
      redis,
      connection: origin.connection,
    });
    await bridgeA.trackConversationPresence({
      redis,
      connection: origin.connection,
      conversationId,
    });
    await bridgeB.touchConnection({
      redis,
      connection: remote.connection,
    });
    await bridgeB.trackConversationPresence({
      redis,
      connection: remote.connection,
      conversationId,
    });

    await bridgeA.ensureStarted({
      eventBus: eventBusA as never,
      runtime: runtimeA,
    });
    await bridgeB.ensureStarted({
      eventBus: eventBusB as never,
      runtime: runtimeB,
    });
    await waitForBridgeReady({ bridge: bridgeA });
    await waitForBridgeReady({ bridge: bridgeB });
    await waitForRealtimeSettle(50);

    await eventBusA.emit(chatEventTopics.messageCreated, {
      messageId: randomUUID(),
      conversationId,
      senderId: origin.connection.user.id,
      kind: "text",
      ciphertext: {
        version: "1",
        algorithm: "signal-sender-key-message-v1",
        conversationType: "group",
        senderDeviceId: origin.connection.user.activeDeviceId,
        senderKeyEpochId: randomUUID(),
        ciphertext: encodeBase58(Buffer.from("cross-node-message-payload")),
        nonce: encodeBase58(Buffer.from("cross-node-message-nonce")),
        sentAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    });

    await waitForFrames({
      sent: remote.socket.sent,
      count: 1,
    });

    expect(origin.socket.sent).toEqual([]);
    expect(remote.socket.sent).toHaveLength(1);
    expect(remote.socket.sent[0]).toMatchObject({
      type: "chat:message:created",
      data: {
        conversationId,
        senderId: origin.connection.user.id,
      },
    });
    expect(
      await observabilityMetrics.getMetricValueForTests(
        "nyx_chat_fanout_events_total",
        {
          source: "remote",
          event: chatEventTopics.messageCreated,
        }
      )
    ).toBe(1);

    await bridgeA.shutdown();
    await bridgeB.shutdown();
  });

  test("non-conversation presence events are not published to redis fanout", async () => {
    const testId = randomUUID().slice(0, 8);
    const bridgeA = createChatRealtimeBridge({
      redisClient: redis,
      subscriber: redis.duplicate(),
      ownsSubscriber: true,
      nodeId: `phase9-node-presence-a-${testId}`,
    });
    const bridgeB = createChatRealtimeBridge({
      redisClient: redis,
      subscriber: redis.duplicate(),
      ownsSubscriber: true,
      nodeId: `phase9-node-presence-b-${testId}`,
    });
    const runtimeB = createChatGatewayRuntime();
    const eventBusA = new EventBus(eventSchemas);
    const eventBusB = new EventBus(eventSchemas);
    const connection = createConnection();
    const conversationId = randomUUID();

    runtimeB.connections.set(connection.connection.connectionId, connection.connection);
    runtimeB.conversationConnections.set(
      conversationId,
      new Set([connection.connection.connectionId])
    );
    connection.connection.subscriptions.add(conversationId);

    await bridgeA.ensureStarted({
      eventBus: eventBusA as never,
      runtime: createChatGatewayRuntime(),
    });
    await bridgeB.ensureStarted({
      eventBus: eventBusB as never,
      runtime: runtimeB,
    });
    await waitForBridgeReady({ bridge: bridgeA });
    await waitForBridgeReady({ bridge: bridgeB });
    await waitForRealtimeSettle(50);

    await eventBusA.emit(chatEventTopics.userOnline, {
      userId: connection.connection.user.id,
      conversationId,
    });

    await waitForRealtimeSettle(150);

    expect(connection.socket.sent).toEqual([]);
    expect(
      await observabilityMetrics.getMetricValueForTests(
        "nyx_chat_fanout_events_total",
        {
          source: "remote",
          event: chatEventTopics.userOnline,
        }
      )
    ).toBeNull();

    await bridgeA.shutdown();
    await bridgeB.shutdown();
  });

  test("stale conversation presence refs are pruned and active user counts are rebuilt", async () => {
    const testId = randomUUID().slice(0, 8);
    const bridge = createChatRealtimeBridge({
      redisClient: redis,
      subscriber: redis.duplicate(),
      ownsSubscriber: true,
      nodeId: `phase9-node-prune-${testId}`,
    });
    const conversationId = randomUUID();
    const live = createConnection({
      userId: randomUUID(),
    });
    const staleConnectionRef = "phase9-stale-node:stale-connection";

    await bridge.trackConversationPresence({
      redis,
      connection: live.connection,
      conversationId,
    });
    await redis.sadd(
      chatRealtimeKeys.conversationConnections(conversationId),
      staleConnectionRef
    );

    await bridge.pruneConversationPresence({
      redis,
      conversationId,
    });

    expect(
      await redis.smembers(chatRealtimeKeys.conversationConnections(conversationId))
    ).toEqual([`${bridge.nodeId}:${live.connection.connectionId}`]);
    expect(await redis.hgetall(chatRealtimeKeys.conversationUsers(conversationId))).toEqual({
      [live.connection.user.id]: "1",
    });

    await bridge.shutdown();
  });

  test("delivery updates are routed across nodes only to sender-side subscribers", async () => {
    const testId = randomUUID().slice(0, 8);
    const bridgeA = createChatRealtimeBridge({
      redisClient: redis,
      subscriber: redis.duplicate(),
      ownsSubscriber: true,
      nodeId: `phase10-node-a-${testId}`,
    });
    const bridgeB = createChatRealtimeBridge({
      redisClient: redis,
      subscriber: redis.duplicate(),
      ownsSubscriber: true,
      nodeId: `phase10-node-b-${testId}`,
    });
    const runtimeA = createChatGatewayRuntime();
    const runtimeB = createChatGatewayRuntime();
    const eventBusA = new EventBus(eventSchemas);
    const eventBusB = new EventBus(eventSchemas);
    const conversationId = randomUUID();
    const recipient = createConnection();
    const sender = createConnection();

    runtimeA.connections.set(recipient.connection.connectionId, recipient.connection);
    runtimeA.conversationConnections.set(
      conversationId,
      new Set([recipient.connection.connectionId])
    );
    recipient.connection.subscriptions.add(conversationId);
    runtimeB.connections.set(sender.connection.connectionId, sender.connection);
    runtimeB.conversationConnections.set(
      conversationId,
      new Set([sender.connection.connectionId])
    );
    sender.connection.subscriptions.add(conversationId);

    await bridgeA.trackConversationPresence({
      redis,
      connection: recipient.connection,
      conversationId,
    });
    await bridgeB.trackConversationPresence({
      redis,
      connection: sender.connection,
      conversationId,
    });

    await bridgeA.ensureStarted({
      eventBus: eventBusA as never,
      runtime: runtimeA,
    });
    await bridgeB.ensureStarted({
      eventBus: eventBusB as never,
      runtime: runtimeB,
    });
    await waitForBridgeReady({ bridge: bridgeA });
    await waitForBridgeReady({ bridge: bridgeB });
    await waitForRealtimeSettle(50);

    await emitUntilFrames({
      emit: async () => {
        await eventBusA.emit(chatEventTopics.deliveryUpdated, {
          messageId: randomUUID(),
          conversationId,
          senderId: sender.connection.user.id,
          userId: recipient.connection.user.id,
          status: "delivered",
          occurredAt: new Date().toISOString(),
        });
      },
      sent: sender.socket.sent,
      count: 1,
      attempts: 4,
      timeoutMs: 900,
    });

    expect(recipient.socket.sent).toEqual([]);
    expect(sender.socket.sent.length).toBeGreaterThan(0);
    expect(sender.socket.sent[0]).toMatchObject({
      type: "chat:delivery:updated",
      data: {
        conversationId,
        userId: recipient.connection.user.id,
        status: "delivered",
      },
    });
    expect((sender.socket.sent[0].data as Record<string, unknown>).senderId).toBeUndefined();
    expect(
      await observabilityMetrics.getMetricValueForTests(
        "nyx_chat_fanout_events_total",
        {
          source: "remote",
          event: chatEventTopics.deliveryUpdated,
        }
      )
    ).toBeGreaterThan(0);

    await bridgeA.shutdown();
    await bridgeB.shutdown();
  });
});
