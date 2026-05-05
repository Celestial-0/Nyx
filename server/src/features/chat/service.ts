import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { abuseInvalidFramePolicy, abusePolicies } from "@/abuse/policies";
import { abuseService } from "@/abuse/service";
import { messageDelivery, messages, messageVisibility, roomMembers, rooms, users } from "@/platform/db/schema";
import { authEventTopics } from "@/features/auth/events/topics";
import {
  loadPendingConversationDeliveries,
  registerChatMessagePipeline,
} from "@/features/chat/pipeline";
import {
  chatRealtimeBridge,
  shouldDeliverRealtimeEventToConnection,
  toOutboundRealtimeFrame,
  type ChatRealtimeBridge,
} from "@/features/chat/realtime";
import { getMessageRetentionCutoff } from "@/features/chat/retention";
import { authService } from "@/features/auth/service";
import { chatEventTopics } from "@/features/chat/events/topics";
import { e2eeService } from "@/features/e2ee/service";
import { observabilityMetrics } from "@/observability";
import { securityOriginPolicy, type SecurityOriginPolicy } from "@/security/origin";
import {
  chatCiphertextSchema,
  chatDeliveryAckDataSchema,
  chatHeartbeatPingDataSchema,
  chatMessageSendDataSchema,
  chatSocketEnvelopeSchema,
  chatSubscriptionDataSchema,
  chatTypingDataSchema,
} from "@/features/chat/schema";
import type {
  ChatConnectionState,
  ChatDeliveryAckData,
  ChatDeliveryStatus,
  ChatDb,
  ChatEventBus,
  ChatHistoryItem,
  ChatHistoryQuery,
  ChatMessageSendData,
  ChatGatewayRuntime,
  ChatJwt,
  ChatRedis,
  ChatSocket,
  ChatSocketEnvelope,
  ChatTypingData,
} from "@/features/chat/types";
import { AppError, BadRequest, Forbidden, NotFound, RateLimited } from "@/shared/error";
import { logger } from "@/shared/logger";

const log = logger.child({ module: "chat.service" });

const WS_STATE_TTL_SECONDS = 60 * 60 * 24;

const roomSummarySelect = {
  id: rooms.id,
  type: rooms.type,
};

const visibleMessageTypes = ["text", "image"] as const;
const toIso = (value: Date | null) => value?.toISOString() ?? null;

const sessionConnectionsKey = (sessionId: string) => `ws:session:${sessionId}:connections`;
const sessionSubscriptionsKey = (sessionId: string) => `ws:session:${sessionId}:subscriptions`;
const connectionSubscriptionsKey = (connectionId: string) => `ws:connection:${connectionId}:subscriptions`;
const conversationConnectionsKey = (conversationId: string) =>
  `ws:conversation:${conversationId}:connections`;

const websocketEventTopics = [
  chatEventTopics.messageCreated,
  chatEventTopics.deliveryUpdated,
  chatEventTopics.messageDeleted,
  chatEventTopics.messageRead,
  chatEventTopics.userOnline,
  chatEventTopics.userOffline,
  chatEventTopics.typingStarted,
  chatEventTopics.typingStopped,
] as const;

const sendFrame = <TData>(socket: ChatSocket, frame: { type: string; requestId?: string; data: TData }) => {
  observabilityMetrics.incrementWsMessageOut(frame.type);
  socket.send(JSON.stringify(frame));
};

const sendErrorFrame = (
  socket: ChatSocket,
  {
    code,
    message,
    requestId,
    retryAfterMs,
  }: {
    code: string;
    message: string;
    requestId?: string;
    retryAfterMs?: number | null;
  }
) => {
  observabilityMetrics.incrementWsMessageRejection({
    type: "ws:connection:error",
    code,
  });

  sendFrame(socket, {
    type: "ws:connection:error",
    requestId,
    data: {
      code,
      message,
      requestId: requestId ?? null,
      ...(retryAfterMs != null ? { retryAfterMs } : {}),
    },
  });
};

const sendRejectedFrame = (
  socket: ChatSocket,
  {
    code,
    message,
    requestId,
    messageId,
    conversationId,
    retryAfterMs,
  }: {
    code: string;
    message: string;
    requestId?: string;
    messageId?: string | null;
    conversationId?: string | null;
    retryAfterMs?: number | null;
  }
) => {
  observabilityMetrics.incrementWsMessageRejection({
    type: "chat:message:rejected",
    code,
  });

  sendFrame(socket, {
    type: "chat:message:rejected",
    requestId,
    data: {
      code,
      message,
      requestId: requestId ?? null,
      messageId: messageId ?? null,
      conversationId: conversationId ?? null,
      retryAfterMs: retryAfterMs ?? null,
    },
  });
};

const refreshRedisKey = async (redis: ChatRedis, key: string) => {
  await redis.expire(key, WS_STATE_TTL_SECONDS);
};

const emitSocketLifecycleEvent = async (
  eventBus: ChatEventBus,
  event: keyof Pick<
    typeof authEventTopics,
    "websocketUserConnected" | "websocketUserDisconnected"
  >,
  userId: string
) => {
  try {
    await eventBus.emit(authEventTopics[event], {
      userId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.warn({ event, userId, error }, "Failed to emit websocket auth event");
  }
};

const getConversation = async (db: ChatDb, conversationId: string) => {
  const results = await db
    .select(roomSummarySelect)
    .from(rooms)
    .where(eq(rooms.id, conversationId))
    .limit(1);

  const conversation = results[0] ?? null;

  if (!conversation) {
    throw NotFound("Conversation not found.");
  }

  return conversation;
};

const parseCiphertextEnvelope = (value: unknown) => {
  const parsed = chatCiphertextSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const assertConversationAccess = async ({
  db,
  conversationId,
  userId,
}: {
  db: ChatDb;
  conversationId: string;
  userId: string;
}) => {
  const conversation = await getConversation(db, conversationId);
  const membership = await db
    .select({
      roomId: roomMembers.roomId,
    })
    .from(roomMembers)
    .where(
      and(
        eq(roomMembers.roomId, conversationId),
        eq(roomMembers.userId, userId),
        isNull(roomMembers.leftAt)
      )
    )
    .limit(1);

  if (!membership[0]) {
    throw Forbidden("You are not an active member of this conversation.");
  }

  return conversation;
};

const assertConversationSubscription = (connection: ChatConnectionState, conversationId: string) => {
  if (!connection.subscriptions.has(conversationId)) {
    throw Forbidden("Subscribe to the conversation before sending realtime chat metadata.");
  }
};

const validateEncryptedMessageEnvelope = async ({
  db,
  conversation,
  userId,
  activeDeviceId,
  input,
}: {
  db: ChatDb;
  conversation: Awaited<ReturnType<typeof getConversation>>;
  userId: string;
  activeDeviceId: string;
  input: ChatMessageSendData;
}) => {
  if (input.ciphertext.senderDeviceId !== activeDeviceId) {
    throw Forbidden("Messages must be sent from the active authenticated device.");
  }

  if (conversation.type === "direct") {
    if (input.ciphertext.conversationType !== "direct") {
      throw BadRequest("Direct conversations require a direct encrypted envelope.");
    }

    const peerDevices = await e2eeService.getRoomMemberDevices({
      db,
      roomId: conversation.id,
    });

    const allowedPeerDeviceIds = new Set(
      peerDevices.filter((device) => device.userId !== userId).map((device) => device.deviceId)
    );

    for (const recipient of input.ciphertext.recipients) {
      if (!allowedPeerDeviceIds.has(recipient.deviceId)) {
        throw Forbidden("Direct message recipients must match active peer devices.");
      }
    }

    return;
  }

  if (input.ciphertext.conversationType !== "group") {
    throw BadRequest("Group conversations require a group encrypted envelope.");
  }

  if (input.ciphertext.distribution) {
    await e2eeService.storeGroupSenderKeyDistribution({
      db,
      roomId: conversation.id,
      senderDeviceId: activeDeviceId,
      distribution: input.ciphertext.distribution,
    });
  }
};

const mapHistoryItem = (message: {
  id: string;
  roomId: string;
  senderId: string;
  type: (typeof visibleMessageTypes)[number] | null;
  content: unknown;
  createdAt: Date | null;
  editedAt: Date | null;
}): ChatHistoryItem | null => {
  const ciphertext = parseCiphertextEnvelope(message.content);

  if (!ciphertext) {
    return null;
  }

  return {
    id: message.id,
    conversationId: message.roomId,
    senderId: message.senderId,
    kind: message.type ?? "text",
    ciphertext,
    createdAt: (message.createdAt ?? new Date()).toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
  };
};

const getVisibleLastMessageForUser = async ({
  db,
  conversationId,
  userId,
}: {
  db: ChatDb;
  conversationId: string;
  userId: string;
}) => {
  const rows = await db
    .select({
      id: messages.id,
      roomId: messages.roomId,
      senderId: messages.senderId,
      type: messages.type,
      content: messages.content,
      createdAt: messages.createdAt,
      editedAt: messages.editedAt,
      hiddenId: messageVisibility.id,
    })
    .from(messages)
    .leftJoin(
      messageVisibility,
      and(
        eq(messageVisibility.messageId, messages.id),
        eq(messageVisibility.userId, userId),
        eq(messageVisibility.isHidden, true)
      )
    )
    .where(
      and(
        eq(messages.roomId, conversationId),
        isNull(messages.deletedAt),
        isNotNull(messages.senderId),
        inArray(messages.type, visibleMessageTypes)
      )
    )
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(5);

  const visibleMessage =
    rows.find((message) => message.hiddenId == null && message.senderId) ?? null;

  if (!visibleMessage || !visibleMessage.senderId) {
    return null;
  }

  return mapHistoryItem({
    ...visibleMessage,
    senderId: visibleMessage.senderId,
    type: visibleMessage.type as (typeof visibleMessageTypes)[number] | null,
  });
};

const getMessageAccess = async ({
  db,
  messageId,
  userId,
}: {
  db: ChatDb;
  messageId: string;
  userId: string;
}) => {
  const rows = await db
    .select({
      id: messages.id,
      conversationId: messages.roomId,
      senderId: messages.senderId,
      deletedAt: messages.deletedAt,
    })
    .from(messages)
    .innerJoin(
      roomMembers,
      and(eq(roomMembers.roomId, messages.roomId), eq(roomMembers.userId, userId))
    )
    .where(and(eq(messages.id, messageId), isNull(roomMembers.leftAt)))
    .limit(1);

  const message = rows[0] ?? null;

  if (!message) {
    throw NotFound("Message not found.");
  }

  return message;
};

const deliveryStatusRank: Record<"sent" | ChatDeliveryStatus, number> = {
  sent: 0,
  delivered: 1,
  read: 2,
};

const replayConversationDeliveries = async ({
  db,
  connection,
  conversationId,
}: {
  db: ChatDb;
  connection: ChatConnectionState;
  conversationId: string;
}) => {
  const pendingMessages = await loadPendingConversationDeliveries({
    db,
    userId: connection.user.id,
    conversationId,
  });

  for (const pendingMessage of pendingMessages) {
    observabilityMetrics.incrementChatDeliveryReplays();
    sendFrame(connection.socket, {
      type: chatEventTopics.messageCreated,
      data: pendingMessage,
    });
  }
};

const resolveMessageForDelivery = async ({
  db,
  messageId,
  conversationId,
}: {
  db: ChatDb;
  messageId: string;
  conversationId: string;
}) => {
  const retentionCutoff = getMessageRetentionCutoff();
  const rows = await db
    .select({
      messageId: messages.id,
      conversationId: messages.roomId,
      senderId: messages.senderId,
      deletedAt: messages.deletedAt,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.roomId, conversationId),
        isNull(messages.deletedAt),
        gte(messages.createdAt, retentionCutoff)
      )
    )
    .limit(1);

  return rows[0] ?? null;
};

const bindConversationToConnection = async ({
  redis,
  runtime,
  connection,
  conversationId,
  persistToSession,
  realtime = chatRealtimeBridge,
}: {
  redis: ChatRedis;
  runtime: ChatGatewayRuntime;
  connection: ChatConnectionState;
  conversationId: string;
  persistToSession: boolean;
  realtime?: ChatRealtimeBridge;
}) => {
  connection.subscriptions.add(conversationId);

  const connectedIds = runtime.conversationConnections.get(conversationId) ?? new Set<string>();
  connectedIds.add(connection.connectionId);
  runtime.conversationConnections.set(conversationId, connectedIds);

  await redis.sadd(connectionSubscriptionsKey(connection.connectionId), conversationId);
  await refreshRedisKey(redis, connectionSubscriptionsKey(connection.connectionId));

  await redis.sadd(conversationConnectionsKey(conversationId), connection.connectionId);
  await refreshRedisKey(redis, conversationConnectionsKey(conversationId));

  if (persistToSession) {
    await redis.sadd(sessionSubscriptionsKey(connection.user.sessionId), conversationId);
    await refreshRedisKey(redis, sessionSubscriptionsKey(connection.user.sessionId));
  }

  return await realtime.trackConversationPresence({
    redis,
    connection,
    conversationId,
  });
};

const unbindConversationFromConnection = async ({
  redis,
  runtime,
  connection,
  conversationId,
  removeFromSession,
  realtime = chatRealtimeBridge,
}: {
  redis: ChatRedis;
  runtime: ChatGatewayRuntime;
  connection: ChatConnectionState;
  conversationId: string;
  removeFromSession: boolean;
  realtime?: ChatRealtimeBridge;
}) => {
  await realtime.untrackConversationPresence({
    redis,
    connection,
    conversationId,
  });

  connection.subscriptions.delete(conversationId);
  await redis.srem(connectionSubscriptionsKey(connection.connectionId), conversationId);
  await redis.srem(conversationConnectionsKey(conversationId), connection.connectionId);

  if (removeFromSession) {
    await redis.srem(sessionSubscriptionsKey(connection.user.sessionId), conversationId);
  }

  const connectionIds = runtime.conversationConnections.get(conversationId);

  if (!connectionIds) {
    return;
  }

  connectionIds.delete(connection.connectionId);

  if (connectionIds.size === 0) {
    runtime.conversationConnections.delete(conversationId);
  }
};

const getEventConversationId = (payload: Record<string, unknown>) => {
  if (typeof payload.conversationId === "string") {
    return payload.conversationId;
  }

  if (typeof payload.roomId === "string") {
    return payload.roomId;
  }

  if (typeof payload.chatId === "string") {
    return payload.chatId;
  }

  return null;
};

const recordInvalidFrameAndMaybeClose = async ({
  redis,
  connection,
}: {
  redis: ChatRedis;
  connection: ChatConnectionState;
}) => {
  const result = await abuseService.recordInvalidFrame({
    redis,
    policy: abuseInvalidFramePolicy,
    subject: abuseService.createSessionSubject(connection.user.sessionId),
  });

  if (result.shouldClose) {
    connection.socket.close(4008, "Rate limited");
  }

  return result;
};

export const createChatGatewayRuntime = (): ChatGatewayRuntime => ({
  connections: new Map(),
  conversationConnections: new Map(),
  eventBindingsInitialized: false,
});

export const chatGatewayRuntime = createChatGatewayRuntime();

export const chatService = {
  registerMessagePipeline: ({
    eventBus,
    db,
  }: {
    eventBus: ChatEventBus;
    db?: ChatDb;
  }) =>
    registerChatMessagePipeline({
      eventBus,
      db,
    }),

  registerEventFanout: ({
    eventBus,
    runtime = chatGatewayRuntime,
  }: {
    eventBus: ChatEventBus;
    runtime?: ChatGatewayRuntime;
  }) => {
    if (runtime.eventBindingsInitialized) {
      return;
    }

    for (const topic of websocketEventTopics) {
      eventBus.on(topic, async (payload) => {
        const conversationId = getEventConversationId(payload as Record<string, unknown>);

        if (!conversationId) {
          return;
        }

        const connectionIds = runtime.conversationConnections.get(conversationId);

        if (!connectionIds || connectionIds.size === 0) {
          return;
        }

        observabilityMetrics.incrementChatFanout({
          source: "local",
          event: topic,
        });

        for (const connectionId of connectionIds) {
          const connection = runtime.connections.get(connectionId);

          if (!connection) {
            continue;
          }

          if (
            !shouldDeliverRealtimeEventToConnection({
              event: topic,
              payload,
              connectionUserId: connection.user.id,
            })
          ) {
            continue;
          }

          try {
            sendFrame(
              connection.socket,
              toOutboundRealtimeFrame({
                event: topic,
                payload,
              })
            );
          } catch (error) {
            log.warn({ connectionId, topic, error }, "Failed to fan out websocket event");
          }
        }
      });
    }

    runtime.eventBindingsInitialized = true;
  },

  registerRealtimeBridge: ({
    eventBus,
    runtime = chatGatewayRuntime,
    realtime = chatRealtimeBridge,
  }: {
    eventBus: ChatEventBus;
    runtime?: ChatGatewayRuntime;
    realtime?: ChatRealtimeBridge;
  }) => realtime.ensureStarted({ eventBus, runtime }),

  openConnection: async ({
    db,
    redis,
    jwt,
    eventBus,
    token,
    sharePresence = true,
    socket,
    origin,
    originPolicy = securityOriginPolicy,
    runtime = chatGatewayRuntime,
    realtime = chatRealtimeBridge,
  }: {
    db: ChatDb;
    redis: ChatRedis;
    jwt: ChatJwt;
    eventBus: ChatEventBus;
    token: string;
    sharePresence?: boolean;
    socket: ChatSocket;
    origin?: string | null;
    originPolicy?: SecurityOriginPolicy;
    runtime?: ChatGatewayRuntime;
    realtime?: ChatRealtimeBridge;
  }) => {
    if (!originPolicy.isWebSocketOriginAllowed(origin)) {
      socket.close(1008, "Forbidden");
      return null;
    }

    const authUser = await authService.resolveSessionFromToken({
      jwt,
      redis,
      db,
      token,
    });

    if (!authUser) {
      socket.close(4001, "Unauthorized");
      return null;
    }

    const websocketCooldownMs = await abuseService.getCooldownRetryAfterMs({
      redis,
      policyKey: abuseInvalidFramePolicy.key,
      subject: abuseService.createSessionSubject(authUser.sessionId),
    });

    if (websocketCooldownMs !== null) {
      socket.close(4008, "Rate limited");
      return null;
    }

    const connectionId = randomUUID();
    const connection: ChatConnectionState = {
      connectionId,
      socket,
      user: authUser,
      subscriptions: new Set<string>(),
      sharePresence,
    };

    runtime.connections.set(connectionId, connection);
    observabilityMetrics.observeWsConnectionOpened();
    await realtime.touchConnection({ redis, connection });
    await redis.sadd(sessionConnectionsKey(authUser.sessionId), connectionId);
    await refreshRedisKey(redis, sessionConnectionsKey(authUser.sessionId));

    const { restored: restoredConversationIds, newlyJoined: newlyJoinedConversationIds } = await chatService.restoreSubscriptions({
      db,
      redis,
      connectionId,
      runtime,
      realtime,
    });

    sendFrame(socket, {
      type: "chat:subscription:restored",
      data: {
        conversationIds: restoredConversationIds,
      },
    });

    sendFrame(socket, {
      type: "ws:connection:ready",
      data: {
        connectionId,
        sessionId: authUser.sessionId,
        user: {
          id: authUser.id,
          walletAddress: authUser.walletAddress,
          role: authUser.role,
          activeDeviceId: authUser.activeDeviceId,
        },
      },
    });

    for (const conversationId of restoredConversationIds) {
      await replayConversationDeliveries({
        db,
        connection,
        conversationId,
      });
    }

    await emitSocketLifecycleEvent(eventBus, "websocketUserConnected", authUser.id);

    for (const conversationId of restoredConversationIds) {
      try {
        if (newlyJoinedConversationIds.includes(conversationId)) {
          await eventBus.emit(chatEventTopics.userOnline, {
            userId: authUser.id,
            conversationId,
          });
        }

        const onlineUsers = await realtime.getConversationUsers({ redis, conversationId });
        
        for (const peerUserId of onlineUsers) {
          if (peerUserId !== authUser.id) {
            sendFrame(
              socket,
              toOutboundRealtimeFrame({
                event: chatEventTopics.userOnline,
                payload: { userId: peerUserId, conversationId },
              })
            );
          }
        }
      } catch (error) {
        log.warn({ conversationId, userId: authUser.id, error }, "Failed to emit user online presence");
      }
    }

    return {
      connectionId,
      user: authUser,
    };
  },

  restoreSubscriptions: async ({
    db,
    redis,
    connectionId,
    runtime = chatGatewayRuntime,
    realtime = chatRealtimeBridge,
  }: {
    db: ChatDb;
    redis: ChatRedis;
    connectionId: string;
    runtime?: ChatGatewayRuntime;
    realtime?: ChatRealtimeBridge;
  }) => {
    const connection = runtime.connections.get(connectionId);

    if (!connection) {
      return { restored: [], newlyJoined: [] };
    }

    const conversationIds = await redis.smembers(sessionSubscriptionsKey(connection.user.sessionId));
    const restored: string[] = [];
    const newlyJoined: string[] = [];

    for (const conversationId of conversationIds) {
      try {
        await assertConversationAccess({
          db,
          conversationId,
          userId: connection.user.id,
        });

        const isNewlyJoined = await bindConversationToConnection({
          redis,
          runtime,
          connection,
          conversationId,
          persistToSession: false,
          realtime,
        });

        restored.push(conversationId);
        
        if (isNewlyJoined) {
          newlyJoined.push(conversationId);
        }
      } catch (error) {
        if (error instanceof AppError) {
          await redis.srem(sessionSubscriptionsKey(connection.user.sessionId), conversationId);
          continue;
        }

        throw error;
      }
    }

    return { restored, newlyJoined };
  },

  addSubscription: async ({
    db,
    redis,
    eventBus,
    connectionId,
    conversationId,
    runtime = chatGatewayRuntime,
    realtime = chatRealtimeBridge,
  }: {
    db: ChatDb;
    redis: ChatRedis;
    eventBus: ChatEventBus;
    connectionId: string;
    conversationId: string;
    runtime?: ChatGatewayRuntime;
    realtime?: ChatRealtimeBridge;
  }) => {
    const connection = runtime.connections.get(connectionId);

    if (!connection) {
      throw BadRequest("Connection is not initialized.");
    }

    const rateLimit = await abuseService.consumePolicy({
      redis,
      policy: abusePolicies.chatSubscriptionOps,
      subject: abuseService.createUserSubject(connection.user.id),
    });

    if (!rateLimit.allowed) {
      throw RateLimited({
        retryAfterMs: rateLimit.retryAfterMs,
        scope: rateLimit.scope,
      });
    }

    const conversation = await assertConversationAccess({
      db,
      conversationId,
      userId: connection.user.id,
    });

    await realtime.touchConnection({ redis, connection });

    const wasSubscribed = connection.subscriptions.has(conversationId);
    const isNewlyJoined = await bindConversationToConnection({
      redis,
      runtime,
      connection,
      conversationId,
      persistToSession: true,
      realtime,
    });

    if (!wasSubscribed) {
      observabilityMetrics.incrementChatSubscriptionsActive();
    }

    sendFrame(connection.socket, {
      type: "chat:subscription:added",
      data: {
        conversationId,
        conversationType: conversation.type,
      },
    });

    await replayConversationDeliveries({
      db,
      connection,
      conversationId,
    });

    if (isNewlyJoined) {
      try {
        await eventBus.emit(chatEventTopics.userOnline, {
          userId: connection.user.id,
          conversationId,
        });
      } catch (error) {
        log.warn({ conversationId, userId: connection.user.id, error }, "Failed to emit user online presence");
      }
    }

    try {
      const onlineUsers = await realtime.getConversationUsers({ redis, conversationId });
      
      for (const peerUserId of onlineUsers) {
        if (peerUserId !== connection.user.id) {
          sendFrame(
            connection.socket,
            toOutboundRealtimeFrame({
              event: chatEventTopics.userOnline,
              payload: { userId: peerUserId, conversationId },
            })
          );
        }
      }
    } catch (error) {
      log.warn({ conversationId, userId: connection.user.id, error }, "Failed to sync initial online presence");
    }
  },

  getConversationList: async ({
    db,
    userId,
    activeDeviceId,
  }: {
    db: ChatDb;
    userId: string;
    activeDeviceId: string;
  }) => {
    const conversationRows = await db
      .select({
        id: rooms.id,
        type: rooms.type,
        createdBy: rooms.createdBy,
        createdAt: rooms.createdAt,
        updatedAt: rooms.updatedAt,
        mutedUntil: roomMembers.mutedUntil,
        lastMessageId: rooms.lastMessageId,
        lastMessageAt: rooms.lastMessageAt,
      })
      .from(roomMembers)
      .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
      .where(and(eq(roomMembers.userId, userId), isNull(roomMembers.leftAt)))
      .orderBy(desc(rooms.lastMessageAt), desc(rooms.updatedAt));

    const conversations = [];

    for (const conversation of conversationRows) {
      let lastMessageKind: "text" | "image" | null = null;
      let lastMessageCiphertext: ChatHistoryItem["ciphertext"] | null = null;
      let effectiveLastMessageId: string | null = null;
      let effectiveLastMessageAt: string | null = null;

      const visibleLastMessage = await getVisibleLastMessageForUser({
        db,
        conversationId: conversation.id,
        userId,
      });

      if (visibleLastMessage) {
        effectiveLastMessageId = visibleLastMessage.id;
        effectiveLastMessageAt = visibleLastMessage.createdAt;
        lastMessageKind = visibleLastMessage.kind;
        lastMessageCiphertext = visibleLastMessage.ciphertext;
      }

      if (conversation.type === "direct") {
        const peerRows = await db
          .select({
            userId: users.id,
            walletAddress: users.walletAddress,
            username: users.username,
            displayName: users.fullName,
          })
          .from(roomMembers)
          .innerJoin(users, eq(users.id, roomMembers.userId))
          .where(
            and(
              eq(roomMembers.roomId, conversation.id),
              isNull(roomMembers.leftAt),
              isNull(users.deletedAt)
            )
          );

        const peer = peerRows.find((row) => row.userId !== userId) ?? null;
        const deviceBundles = await e2eeService.getRoomMemberDevices({
          db,
          roomId: conversation.id,
        });

        conversations.push({
          id: conversation.id,
          type: conversation.type,
          createdBy: conversation.createdBy,
          createdAt: (conversation.createdAt ?? new Date()).toISOString(),
          updatedAt: (conversation.updatedAt ?? new Date()).toISOString(),
          mutedUntil: toIso(conversation.mutedUntil),
          lastMessageId: effectiveLastMessageId,
          lastMessageAt: effectiveLastMessageAt,
          lastMessageKind,
          lastMessageCiphertext,
          directPeer: peer
            ? {
                userId: peer.userId,
                walletAddress: peer.walletAddress,
                username: peer.username,
                displayName: peer.displayName,
                deviceBundles: deviceBundles.filter((device) => device.userId === peer.userId),
              }
            : null,
          groupState: null,
        });
        continue;
      }

      const memberCountRows = await db
        .select({ userId: roomMembers.userId })
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, conversation.id), isNull(roomMembers.leftAt)));

      conversations.push({
        id: conversation.id,
        type: conversation.type,
        createdBy: conversation.createdBy,
        createdAt: (conversation.createdAt ?? new Date()).toISOString(),
        updatedAt: (conversation.updatedAt ?? new Date()).toISOString(),
        mutedUntil: toIso(conversation.mutedUntil),
        lastMessageId: effectiveLastMessageId,
        lastMessageAt: effectiveLastMessageAt,
        lastMessageKind,
        lastMessageCiphertext,
        directPeer: null,
        groupState: {
          memberCount: memberCountRows.length,
          senderKeyState: await e2eeService.getRoomSenderKeyState({
            db,
            roomId: conversation.id,
            userId,
            activeDeviceId,
          }),
        },
      });
    }

    return {
      conversations: conversations.sort((left, right) => {
        const leftTimestamp = left.lastMessageAt ?? left.updatedAt;
        const rightTimestamp = right.lastMessageAt ?? right.updatedAt;

        return new Date(rightTimestamp).getTime() - new Date(leftTimestamp).getTime();
      }),
    };
  },

  getConversationHistory: async ({
    db,
    conversationId,
    userId,
    query,
  }: {
    db: ChatDb;
    conversationId: string;
    userId: string;
    query: ChatHistoryQuery;
  }) => {
    await assertConversationAccess({
      db,
      conversationId,
      userId,
    });

    const retentionCutoff = getMessageRetentionCutoff();
    let cursor:
      | {
          id: string;
          roomId: string;
          createdAt: Date | null;
          deletedAt: Date | null;
          type: string | null;
          content: unknown;
        }
      | null = null;

    if (query.beforeMessageId) {
      const cursorRows = await db
        .select({
          id: messages.id,
          roomId: messages.roomId,
          createdAt: messages.createdAt,
          deletedAt: messages.deletedAt,
          type: messages.type,
          content: messages.content,
        })
        .from(messages)
        .where(eq(messages.id, query.beforeMessageId))
        .limit(1);

      cursor = cursorRows[0] ?? null;

      if (!cursor) {
        throw BadRequest("Invalid history cursor.");
      }

      if (cursor.roomId !== conversationId) {
        throw BadRequest("History cursor does not belong to this conversation.");
      }

      const isVisibleCursor =
        cursor.deletedAt === null &&
        cursor.createdAt !== null &&
        cursor.createdAt >= retentionCutoff &&
        parseCiphertextEnvelope(cursor.content) !== null &&
        visibleMessageTypes.includes((cursor.type ?? "") as (typeof visibleMessageTypes)[number]);

      if (!isVisibleCursor) {
        throw BadRequest("Invalid history cursor.");
      }
    }

    const filters = [
      eq(messages.roomId, conversationId),
      isNull(messages.deletedAt),
      isNotNull(messages.senderId),
      inArray(messages.type, visibleMessageTypes),
      gte(messages.createdAt, retentionCutoff),
    ];

    if (cursor?.createdAt) {
      filters.push(
        or(
          lt(messages.createdAt, cursor.createdAt),
          and(eq(messages.createdAt, cursor.createdAt), lt(messages.id, cursor.id))
        )!
      );
    }

    const rows = await db
      .select({
        id: messages.id,
        roomId: messages.roomId,
        senderId: messages.senderId,
        type: messages.type,
        content: messages.content,
        createdAt: messages.createdAt,
        editedAt: messages.editedAt,
        hiddenId: messageVisibility.id,
      })
      .from(messages)
      .leftJoin(
        messageVisibility,
        and(
          eq(messageVisibility.messageId, messages.id),
          eq(messageVisibility.userId, userId),
          eq(messageVisibility.isHidden, true)
        )
      )
      .where(and(...filters))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(query.limit + 1);

    const visibleRows = rows.filter((message) => message.hiddenId == null);
    const hasMore = visibleRows.length > query.limit;
    const pageRows = hasMore ? visibleRows.slice(0, query.limit) : visibleRows;
    const historyItems = pageRows
      .map((message) =>
        mapHistoryItem({
          ...message,
          senderId: message.senderId!,
          type: message.type as (typeof visibleMessageTypes)[number] | null,
        })
      )
      .filter((message): message is ChatHistoryItem => message !== null);

    return {
      messages: historyItems,
      pageInfo: {
        limit: query.limit,
        hasMore,
        nextBeforeMessageId: hasMore ? historyItems.at(-1)?.id ?? null : null,
      },
    };
  },

  hideMessageForUser: async ({
    db,
    messageId,
    userId,
  }: {
    db: ChatDb;
    messageId: string;
    userId: string;
  }) => {
    const message = await getMessageAccess({
      db,
      messageId,
      userId,
    });

    await db
      .insert(messageVisibility)
      .values({
        messageId,
        userId,
        isHidden: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [messageVisibility.messageId, messageVisibility.userId],
        set: {
          isHidden: true,
          updatedAt: new Date(),
        },
      });

    return {
      messageId,
      conversationId: message.conversationId,
      hidden: true,
    };
  },

  deleteMessageForEveryone: async ({
    db,
    eventBus,
    messageId,
    userId,
  }: {
    db: ChatDb;
    eventBus: ChatEventBus;
    messageId: string;
    userId: string;
  }) => {
    const message = await getMessageAccess({
      db,
      messageId,
      userId,
    });

    if (message.senderId !== userId) {
      throw Forbidden("Only the original sender can delete this message for everyone.");
    }

    if (!message.deletedAt) {
      const now = new Date();
      await db
        .update(messages)
        .set({
          deletedAt: now,
          deletedBy: userId,
        })
        .where(eq(messages.id, messageId));

      try {
        await eventBus.emit(chatEventTopics.messageDeleted, {
          conversationId: message.conversationId,
          id: messageId,
        });
      } catch (error) {
        log.warn({ messageId, error }, "Failed to emit message delete event");
      }
    }

    return {
      messageId,
      conversationId: message.conversationId,
      deleted: true,
    };
  },

  acknowledgeDelivery: async ({
    db,
    redis,
    eventBus,
    connectionId,
    input,
    runtime = chatGatewayRuntime,
    realtime = chatRealtimeBridge,
  }: {
    db: ChatDb;
    redis: ChatRedis;
    eventBus: ChatEventBus;
    connectionId: string;
    input: ChatDeliveryAckData;
    runtime?: ChatGatewayRuntime;
    realtime?: ChatRealtimeBridge;
  }) => {
    const connection = runtime.connections.get(connectionId);

    if (!connection) {
      throw BadRequest("Connection is not initialized.");
    }

    await assertConversationAccess({
      db,
      conversationId: input.conversationId,
      userId: connection.user.id,
    });

    await realtime.touchConnection({ redis, connection });

    const message = await resolveMessageForDelivery({
      db,
      messageId: input.messageId,
      conversationId: input.conversationId,
    });

    if (!message) {
      throw NotFound("Message not found in this conversation.");
    }

    if (message.senderId === connection.user.id) {
      throw BadRequest("Sender cannot acknowledge their own message.");
    }

    const now = new Date();
    const occurredAt = now.toISOString();
    const deliveryRows = await db
      .select({
        id: messageDelivery.id,
        status: messageDelivery.status,
      })
      .from(messageDelivery)
      .where(
        and(
          eq(messageDelivery.messageId, input.messageId),
          eq(messageDelivery.userId, connection.user.id)
        )
      )
      .limit(1);

    let currentStatus: "sent" | ChatDeliveryStatus = "sent";

    if (!deliveryRows[0]) {
      await db.insert(messageDelivery).values({
        messageId: input.messageId,
        userId: connection.user.id,
        status: "sent",
        updatedAt: now,
      });
    } else {
      currentStatus = deliveryRows[0].status as "sent" | ChatDeliveryStatus;
    }

    const currentRank = deliveryStatusRank[currentStatus];
    const nextRank = deliveryStatusRank[input.status];

    if (nextRank <= currentRank) {
      return;
    }

    await db
      .update(messageDelivery)
      .set({
        status: input.status,
        updatedAt: now,
      })
      .where(
        and(
          eq(messageDelivery.messageId, input.messageId),
          eq(messageDelivery.userId, connection.user.id)
        )
      );

    if (input.status === "read" && currentStatus === "sent") {
      await eventBus.emit(chatEventTopics.deliveryUpdated, {
        messageId: input.messageId,
        conversationId: input.conversationId,
        senderId: message.senderId!,
        userId: connection.user.id,
        status: "delivered",
        occurredAt,
      });
    }

    await eventBus.emit(chatEventTopics.deliveryUpdated, {
      messageId: input.messageId,
      conversationId: input.conversationId,
      senderId: message.senderId!,
      userId: connection.user.id,
      status: input.status,
      occurredAt,
    });
  },

  sendMessage: async ({
    db,
    redis,
    eventBus,
    connectionId,
    input,
    requestId,
    runtime = chatGatewayRuntime,
    realtime = chatRealtimeBridge,
  }: {
    db: ChatDb;
    redis: ChatRedis;
    eventBus: ChatEventBus;
    connectionId: string;
    input: ChatMessageSendData;
    requestId?: string;
    runtime?: ChatGatewayRuntime;
    realtime?: ChatRealtimeBridge;
  }) => {
    const connection = runtime.connections.get(connectionId);

    if (!connection) {
      throw BadRequest("Connection is not initialized.");
    }

    const conversation = await assertConversationAccess({
      db,
      conversationId: input.conversationId,
      userId: connection.user.id,
    });

    await validateEncryptedMessageEnvelope({
      db,
      conversation,
      userId: connection.user.id,
      activeDeviceId: connection.user.activeDeviceId,
      input,
    });

    await realtime.touchConnection({ redis, connection });

    const rateLimit = await realtime.consumeMessageRateLimit({
      redis,
      userId: connection.user.id,
    });

    if (!rateLimit.allowed) {
      sendRejectedFrame(connection.socket, {
        code: "RATE_LIMITED",
        message: "Message send rate limit exceeded.",
        requestId,
        messageId: input.messageId,
        conversationId: input.conversationId,
        retryAfterMs: rateLimit.retryAfterMs,
      });
      return;
    }

    const dedupeClaimed = await realtime.claimMessageDeduplication({
      redis,
      messageId: input.messageId,
    });

    if (!dedupeClaimed) {
      sendRejectedFrame(connection.socket, {
        code: "CONFLICT",
        message: "Message already exists for this messageId.",
        requestId,
        messageId: input.messageId,
        conversationId: input.conversationId,
      });
      return;
    }

    const submittedAt = new Date().toISOString();

    try {
      await eventBus.emitStrict(chatEventTopics.messageSubmitted, {
        messageId: input.messageId,
        conversationId: input.conversationId,
        senderId: connection.user.id,
        kind: input.kind,
        ciphertext: input.ciphertext,
        clientTimestamp: input.clientTimestamp,
        submittedAt,
      });
    } catch (error) {
      if (!(error instanceof AppError && error.code === "CONFLICT")) {
        await realtime.releaseMessageDeduplication({
          redis,
          messageId: input.messageId,
        });
      }

      if (error instanceof AppError) {
        sendRejectedFrame(connection.socket, {
          code: error.code,
          message: error.message,
          requestId,
          messageId: input.messageId,
          conversationId: input.conversationId,
        });
        return;
      }

      log.error(
        {
          connectionId,
          conversationId: input.conversationId,
          messageId: input.messageId,
          error,
        },
        "Failed to submit chat message"
      );

      sendRejectedFrame(connection.socket, {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to process the message.",
        requestId,
        messageId: input.messageId,
        conversationId: input.conversationId,
      });
      return;
    }

    sendFrame(connection.socket, {
      type: "chat:message:accepted",
      requestId,
      data: {
        messageId: input.messageId,
        conversationId: input.conversationId,
        acceptedAt: new Date().toISOString(),
      },
    });
  },

  removeSubscription: async ({
    redis,
    connectionId,
    conversationId,
    runtime = chatGatewayRuntime,
    realtime = chatRealtimeBridge,
  }: {
    redis: ChatRedis;
    connectionId: string;
    conversationId: string;
    runtime?: ChatGatewayRuntime;
    realtime?: ChatRealtimeBridge;
  }) => {
    const connection = runtime.connections.get(connectionId);

    if (!connection) {
      throw BadRequest("Connection is not initialized.");
    }

    const rateLimit = await abuseService.consumePolicy({
      redis,
      policy: abusePolicies.chatSubscriptionOps,
      subject: abuseService.createUserSubject(connection.user.id),
    });

    if (!rateLimit.allowed) {
      throw RateLimited({
        retryAfterMs: rateLimit.retryAfterMs,
        scope: rateLimit.scope,
      });
    }

    await realtime.touchConnection({ redis, connection });

    const hadSubscription = connection.subscriptions.has(conversationId);

    if (hadSubscription) {
      await unbindConversationFromConnection({
        redis,
        runtime,
        connection,
        conversationId,
        removeFromSession: true,
        realtime,
      });

      observabilityMetrics.decrementChatSubscriptionsActive();
    } else {
      await redis.srem(sessionSubscriptionsKey(connection.user.sessionId), conversationId);
    }

    sendFrame(connection.socket, {
      type: "chat:subscription:removed",
      data: {
        conversationId,
      },
    });
  },

  updateTypingState: async ({
    db,
    redis,
    eventBus,
    connectionId,
    input,
    isTyping,
    runtime = chatGatewayRuntime,
    realtime = chatRealtimeBridge,
  }: {
    db: ChatDb;
    redis: ChatRedis;
    eventBus: ChatEventBus;
    connectionId: string;
    input: ChatTypingData;
    isTyping: boolean;
    runtime?: ChatGatewayRuntime;
    realtime?: ChatRealtimeBridge;
  }) => {
    const connection = runtime.connections.get(connectionId);

    if (!connection) {
      throw BadRequest("Connection is not initialized.");
    }

    await assertConversationAccess({
      db,
      conversationId: input.conversationId,
      userId: connection.user.id,
    });

    assertConversationSubscription(connection, input.conversationId);
    await realtime.touchConnection({ redis, connection });

    await eventBus.emit(
      isTyping ? chatEventTopics.typingStarted : chatEventTopics.typingStopped,
      {
        conversationId: input.conversationId,
        userId: connection.user.id,
      }
    );
  },

  handleIncomingMessage: async ({
    db,
    redis,
    eventBus,
    connectionId,
    rawMessage,
    runtime = chatGatewayRuntime,
    realtime = chatRealtimeBridge,
  }: {
    db: ChatDb;
    redis: ChatRedis;
    eventBus: ChatEventBus;
    connectionId: string;
    rawMessage: unknown;
    runtime?: ChatGatewayRuntime;
    realtime?: ChatRealtimeBridge;
  }) => {
    const connection = runtime.connections.get(connectionId);

    if (!connection) {
      return;
    }

    if (typeof rawMessage !== "string") {
      const invalidFrame = await recordInvalidFrameAndMaybeClose({
        redis,
        connection,
      });

      if (invalidFrame.shouldClose) {
        return;
      }

      sendErrorFrame(connection.socket, {
        code: "UNSUPPORTED_DATA",
        message: "Only text websocket frames are supported.",
        retryAfterMs: invalidFrame.retryAfterMs,
      });
      return;
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(rawMessage);
    } catch {
      const invalidFrame = await recordInvalidFrameAndMaybeClose({
        redis,
        connection,
      });

      if (invalidFrame.shouldClose) {
        return;
      }

      sendErrorFrame(connection.socket, {
        code: "INVALID_JSON",
        message: "Malformed JSON payload.",
        retryAfterMs: invalidFrame.retryAfterMs,
      });
      return;
    }

    const envelopeResult = chatSocketEnvelopeSchema.safeParse(parsedJson);

    if (!envelopeResult.success) {
      const invalidFrame = await recordInvalidFrameAndMaybeClose({
        redis,
        connection,
      });

      if (invalidFrame.shouldClose) {
        return;
      }

      sendErrorFrame(connection.socket, {
        code: "INVALID_MESSAGE",
        message: "Invalid websocket message envelope.",
        retryAfterMs: invalidFrame.retryAfterMs,
      });
      return;
    }

    const envelope = envelopeResult.data as ChatSocketEnvelope;
    observabilityMetrics.incrementWsMessageIn(envelope.type);

    switch (envelope.type) {
      case "ws:heartbeat:ping": {
        const pingPayload = chatHeartbeatPingDataSchema.safeParse(envelope.data);

        if (!pingPayload.success) {
          sendErrorFrame(connection.socket, {
            code: "INVALID_MESSAGE",
            message: "Invalid heartbeat payload.",
            requestId: envelope.requestId,
          });
          return;
        }

        await realtime.touchConnection({ redis, connection });

        sendFrame(connection.socket, {
          type: "ws:heartbeat:pong",
          requestId: envelope.requestId,
          data: {
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }
      case "chat:subscription:add": {
        const data = chatSubscriptionDataSchema.safeParse(envelope.data);

        if (!data.success) {
          sendErrorFrame(connection.socket, {
            code: "INVALID_MESSAGE",
            message: "Invalid subscription payload.",
            requestId: envelope.requestId,
          });
          return;
        }

        try {
          await chatService.addSubscription({
            db,
            redis,
            eventBus,
            connectionId,
            conversationId: data.data.conversationId,
            runtime,
            realtime,
          });
        } catch (error) {
          if (error instanceof AppError) {
            sendErrorFrame(connection.socket, {
              code: error.code,
              message: error.message,
              requestId: envelope.requestId,
              retryAfterMs:
                error.code === "RATE_LIMITED" &&
                error.details &&
                typeof error.details === "object" &&
                error.details !== null &&
                "retryAfterMs" in error.details
                  ? ((error.details as { retryAfterMs?: number | null }).retryAfterMs ?? null)
                  : null,
            });
            return;
          }

          throw error;
        }
        return;
      }
      case "chat:subscription:remove": {
        const data = chatSubscriptionDataSchema.safeParse(envelope.data);

        if (!data.success) {
          sendErrorFrame(connection.socket, {
            code: "INVALID_MESSAGE",
            message: "Invalid unsubscription payload.",
            requestId: envelope.requestId,
          });
          return;
        }

        try {
          await chatService.removeSubscription({
            redis,
            connectionId,
            conversationId: data.data.conversationId,
            runtime,
            realtime,
          });
        } catch (error) {
          if (error instanceof AppError) {
            sendErrorFrame(connection.socket, {
              code: error.code,
              message: error.message,
              requestId: envelope.requestId,
              retryAfterMs:
                error.code === "RATE_LIMITED" &&
                error.details &&
                typeof error.details === "object" &&
                error.details !== null &&
                "retryAfterMs" in error.details
                  ? ((error.details as { retryAfterMs?: number | null }).retryAfterMs ?? null)
                  : null,
            });
            return;
          }

          throw error;
        }
        return;
      }
      case "chat:message:send": {
        const data = chatMessageSendDataSchema.safeParse(envelope.data);

        if (!data.success) {
          const raw =
            typeof envelope.data === "object" && envelope.data !== null
              ? (envelope.data as Record<string, unknown>)
              : {};

          sendRejectedFrame(connection.socket, {
            code: "INVALID_MESSAGE",
            message: "Invalid message send payload.",
            requestId: envelope.requestId,
            messageId: typeof raw.messageId === "string" ? raw.messageId : null,
            conversationId:
              typeof raw.conversationId === "string" ? raw.conversationId : null,
          });
          return;
        }

        try {
          await chatService.sendMessage({
            db,
            redis,
            eventBus,
            connectionId,
            input: data.data,
            requestId: envelope.requestId,
            runtime,
            realtime,
          });
        } catch (error) {
          if (error instanceof AppError) {
            sendRejectedFrame(connection.socket, {
              code: error.code,
              message: error.message,
              requestId: envelope.requestId,
              messageId: data.data.messageId,
              conversationId: data.data.conversationId,
            });
            return;
          }

          throw error;
        }
        return;
      }
      case "chat:delivery:ack": {
        const data = chatDeliveryAckDataSchema.safeParse(envelope.data);

        if (!data.success) {
          sendErrorFrame(connection.socket, {
            code: "INVALID_MESSAGE",
            message: "Invalid delivery acknowledgment payload.",
            requestId: envelope.requestId,
          });
          return;
        }

        try {
          await chatService.acknowledgeDelivery({
            db,
            redis,
            eventBus,
            connectionId,
            input: data.data,
            runtime,
            realtime,
          });
        } catch (error) {
          if (error instanceof AppError) {
            sendErrorFrame(connection.socket, {
              code: error.code,
              message: error.message,
              requestId: envelope.requestId,
            });
            return;
          }

          throw error;
        }
        return;
      }
      case "chat:typing:start":
      case "chat:typing:stop": {
        const data = chatTypingDataSchema.safeParse(envelope.data);

        if (!data.success) {
          sendErrorFrame(connection.socket, {
            code: "INVALID_MESSAGE",
            message: "Invalid typing payload.",
            requestId: envelope.requestId,
          });
          return;
        }

        try {
          await chatService.updateTypingState({
            db,
            redis,
            eventBus,
            connectionId,
            input: data.data,
            isTyping: envelope.type === "chat:typing:start",
            runtime,
            realtime,
          });
        } catch (error) {
          if (error instanceof AppError) {
            sendErrorFrame(connection.socket, {
              code: error.code,
              message: error.message,
              requestId: envelope.requestId,
            });
            return;
          }

          throw error;
        }
        return;
      }
      default:
        sendErrorFrame(connection.socket, {
          code: "INVALID_MESSAGE_TYPE",
          message: `Unsupported websocket message type "${envelope.type}".`,
          requestId: envelope.requestId,
        });
    }
  },

  closeConnection: async ({
    redis,
    eventBus,
    connectionId,
    closeCode,
    runtime = chatGatewayRuntime,
    realtime = chatRealtimeBridge,
  }: {
    redis: ChatRedis;
    eventBus: ChatEventBus;
    connectionId: string;
    closeCode?: number;
    runtime?: ChatGatewayRuntime;
    realtime?: ChatRealtimeBridge;
  }) => {
    const connection = runtime.connections.get(connectionId);

    if (!connection) {
      return;
    }

    const redisSubscriptions = await redis.smembers(connectionSubscriptionsKey(connectionId));
    const allSubscriptions = new Set([
      ...connection.subscriptions,
      ...redisSubscriptions,
    ]);

    const fullyDisconnectedConversationIds = await realtime.removeConnectionPresence({
      redis,
      connection,
      conversationIds: [...allSubscriptions],
    });

    for (const conversationId of allSubscriptions) {
      try {
        if (fullyDisconnectedConversationIds.includes(conversationId)) {
          await eventBus.emit(chatEventTopics.userOffline, {
            userId: connection.user.id,
            conversationId,
          });
        }
      } catch (error) {
        log.warn({ conversationId, userId: connection.user.id, error }, "Failed to emit user offline presence");
      }
    }

    for (const conversationId of allSubscriptions) {
      await redis.srem(conversationConnectionsKey(conversationId), connectionId);

      const connectionIds = runtime.conversationConnections.get(conversationId);

      if (!connectionIds) {
        continue;
      }

      connectionIds.delete(connectionId);

      if (connectionIds.size === 0) {
        runtime.conversationConnections.delete(conversationId);
      }
    }

    await redis.del(connectionSubscriptionsKey(connectionId));
    await redis.srem(sessionConnectionsKey(connection.user.sessionId), connectionId);

    for (const _conversationId of allSubscriptions) {
      observabilityMetrics.decrementChatSubscriptionsActive();
    }

    runtime.connections.delete(connectionId);
    observabilityMetrics.observeWsConnectionClosed(closeCode);

    await emitSocketLifecycleEvent(eventBus, "websocketUserDisconnected", connection.user.id);
  },
};
