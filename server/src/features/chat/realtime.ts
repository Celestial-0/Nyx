import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import { abusePolicies } from "@/abuse/policies";
import { abuseService } from "@/abuse/service";
import { env } from "@/config/env";
import { redis } from "@/platform/redis/client";
import { observabilityMetrics } from "@/observability";
import { chatEventTopics } from "@/features/chat/events/topics";
import type {
  ChatConnectionState,
  ChatEventBus,
  ChatGatewayRuntime,
  ChatRateLimitResult,
  ChatRealtimeEnvelope,
  ChatRedis,
} from "@/features/chat/types";
import { logger } from "@/shared/logger";

const log = logger.child({ module: "chat.realtime" });

const REALTIME_CHANNEL = "realtime:chat:events";
const publishedRealtimeTopics = [
  chatEventTopics.messageCreated,
  chatEventTopics.deliveryUpdated,
  chatEventTopics.messageDeleted,
  chatEventTopics.messageRead,
  chatEventTopics.userOnline,
  chatEventTopics.userOffline,
  chatEventTopics.typingStarted,
  chatEventTopics.typingStopped,
] as const;

const sendRealtimeFrame = (socket: { send: (data: string) => void }, frame: { type: string; data: unknown }) => {
  socket.send(JSON.stringify(frame));
};

const getOutboundRealtimeData = (event: string, payload: unknown) => {
  if (
    event === chatEventTopics.deliveryUpdated &&
    payload &&
    typeof payload === "object"
  ) {
    const {
      messageId,
      conversationId,
      userId,
      status,
      occurredAt,
    } = payload as Record<string, unknown>;

    return {
      messageId,
      conversationId,
      userId,
      status,
      occurredAt,
    };
  }

  return payload;
};

export const shouldDeliverRealtimeEventToConnection = ({
  event,
  payload,
  connectionUserId,
}: {
  event: string;
  payload: unknown;
  connectionUserId: string;
}) => {
  if (
    event === chatEventTopics.deliveryUpdated &&
    payload &&
    typeof payload === "object"
  ) {
    return (payload as { senderId?: string }).senderId === connectionUserId;
  }

  if (
    (event === chatEventTopics.userOnline || event === chatEventTopics.userOffline) &&
    payload &&
    typeof payload === "object"
  ) {
    return (payload as { userId?: string }).userId !== connectionUserId;
  }

  return true;
};

export const toOutboundRealtimeFrame = ({
  event,
  payload,
}: {
  event: string;
  payload: unknown;
}) => ({
  type: event,
  data: getOutboundRealtimeData(event, payload),
});

const getConversationIdFromPayload = (payload: Record<string, unknown>) => {
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

const parseConnectionRef = (connectionRef: string) => {
  const [nodeId, connectionId] = connectionRef.split(":");

  if (!nodeId || !connectionId) {
    return null;
  }

  return {
    nodeId,
    connectionId,
  };
};

export const chatRealtimeKeys = {
  connectionAlive: (nodeId: string, connectionId: string) =>
    `realtime:connection:${nodeId}:${connectionId}`,
  conversationConnections: (conversationId: string) =>
    `realtime:conversation:${conversationId}:connections`,
  conversationUsers: (conversationId: string) =>
    `realtime:conversation:${conversationId}:users`,
  messageDedupe: (messageId: string) => `realtime:dedupe:message:${messageId}`,
  messageRateLimit: (userId: string) => `ratelimit:ws:message:user:${userId}`,
};

export const createConnectionRef = (nodeId: string, connectionId: string) => `${nodeId}:${connectionId}`;

export const createChatRealtimeBridge = ({
  redisClient = redis,
  nodeId = env.REALTIME_NODE_ID ?? randomUUID(),
  activeConnectionTtlSeconds = env.REALTIME_ACTIVE_CONNECTION_TTL_SECONDS,
  messageDedupeTtlSeconds = env.REALTIME_MESSAGE_DEDUPE_TTL_SECONDS,
  rateLimitCapacity = env.REALTIME_RATE_LIMIT_CAPACITY,
  rateLimitRefillPerSecond = env.REALTIME_RATE_LIMIT_REFILL_PER_SECOND,
  subscriber,
  ownsSubscriber = subscriber === undefined,
}: {
  redisClient?: ChatRedis;
  subscriber?: Redis;
  nodeId?: string;
  activeConnectionTtlSeconds?: number;
  messageDedupeTtlSeconds?: number;
  rateLimitCapacity?: number;
  rateLimitRefillPerSecond?: number;
  ownsSubscriber?: boolean;
} = {}) => {
  let runtimeRef: ChatGatewayRuntime | null = null;
  let subscriberClient: Redis | null = subscriber ?? null;
  let subscriberStarted = false;
  let subscriberConnected = false;
  let subscriberSubscribed = false;
  let publisherBound = new WeakSet<object>();
  let subscriberHandlerBound = false;
  let readinessLogged = false;

  const updateRealtimeReadiness = ({
    connected = subscriberConnected,
    subscribed = subscriberSubscribed,
  }: {
    connected?: boolean;
    subscribed?: boolean;
  }) => {
    subscriberConnected = connected;
    subscriberSubscribed = subscribed;

    const isReady = subscriberConnected && subscriberSubscribed;
    observabilityMetrics.setDependencyUp("realtime", isReady);

    if (isReady && !readinessLogged) {
      log.info({ nodeId, channel: REALTIME_CHANNEL }, "Realtime subscriber is ready");
      readinessLogged = true;
    }

    if (!isReady && readinessLogged) {
      log.warn(
        {
          nodeId,
          channel: REALTIME_CHANNEL,
          subscriberConnected,
          subscriberSubscribed,
        },
        "Realtime subscriber is not ready"
      );
      readinessLogged = false;
    }
  };

  const handleSubscriberMessage = async (_channel: string, rawPayload: string) => {
    if (!runtimeRef) {
      return;
    }

    let envelope: ChatRealtimeEnvelope | null = null;

    try {
      envelope = JSON.parse(rawPayload) as ChatRealtimeEnvelope;
    } catch (error) {
      log.warn({ rawPayload, error }, "Failed to parse realtime pubsub payload");
      return;
    }

    if (!envelope || envelope.originNodeId === nodeId) {
      return;
    }

    if (typeof envelope.conversationId !== "string" || typeof envelope.event !== "string") {
      return;
    }

    await bridge.pruneConversationPresence({
      redis: redisClient,
      conversationId: envelope.conversationId,
    });

    const connectionIds = runtimeRef.conversationConnections.get(envelope.conversationId);

    if (!connectionIds || connectionIds.size === 0) {
      return;
    }

    observabilityMetrics.incrementChatFanout({
      source: "remote",
      event: envelope.event,
    });

    for (const connectionId of connectionIds) {
      const connection = runtimeRef.connections.get(connectionId);

      if (!connection) {
        continue;
      }

      if (
        !shouldDeliverRealtimeEventToConnection({
          event: envelope.event,
          payload: envelope.payload,
          connectionUserId: connection.user.id,
        })
      ) {
        continue;
      }

      try {
        sendRealtimeFrame(
          connection.socket,
          toOutboundRealtimeFrame({
            event: envelope.event,
            payload: envelope.payload,
          })
        );
      } catch (error) {
        log.warn({ connectionId, event: envelope.event, error }, "Failed to fan out remote realtime event");
      }
    }
  };

  const bridge = {
    nodeId,
    channel: REALTIME_CHANNEL,

    ensureStarted: async ({
      eventBus,
      runtime,
    }: {
      eventBus: ChatEventBus;
      runtime: ChatGatewayRuntime;
    }) => {
      runtimeRef = runtime;

      if (!publisherBound.has(eventBus)) {
        for (const topic of publishedRealtimeTopics) {
          eventBus.on(topic, async (payload) => {
            const conversationId = getConversationIdFromPayload(payload as Record<string, unknown>);

            if (!conversationId) {
              return;
            }

            const envelope: ChatRealtimeEnvelope = {
              originNodeId: nodeId,
              event: topic,
              conversationId,
              payload,
            };

            await redisClient.publish(REALTIME_CHANNEL, JSON.stringify(envelope));
          });
        }

        publisherBound.add(eventBus);
      }

      if (!subscriberHandlerBound) {
        subscriberClient ??= redisClient.duplicate();
        subscriberClient.on("connect", () => {
          updateRealtimeReadiness({ connected: true });
        });
        subscriberClient.on("ready", () => {
          updateRealtimeReadiness({ connected: true });
        });
        subscriberClient.on("close", () => {
          updateRealtimeReadiness({ connected: false, subscribed: false });
        });
        subscriberClient.on("end", () => {
          updateRealtimeReadiness({ connected: false, subscribed: false });
        });
        subscriberClient.on("reconnecting", () => {
          updateRealtimeReadiness({ connected: false, subscribed: false });
        });
        subscriberClient.on("error", () => {
          updateRealtimeReadiness({ connected: false, subscribed: false });
        });
        subscriberClient.on("message", handleSubscriberMessage);
        subscriberHandlerBound = true;
      }

      if (!subscriberStarted) {
        subscriberClient ??= redisClient.duplicate();
        await subscriberClient.subscribe(REALTIME_CHANNEL);
        subscriberStarted = true;
        updateRealtimeReadiness({ connected: true, subscribed: true });
      }
    },

    touchConnection: async ({
      redis,
      connection,
    }: {
      redis: ChatRedis;
      connection: ChatConnectionState;
    }) => {
      await redis.setex(
        chatRealtimeKeys.connectionAlive(nodeId, connection.connectionId),
        activeConnectionTtlSeconds,
        JSON.stringify({
          userId: connection.user.id,
          sessionId: connection.user.sessionId,
          sharePresence: connection.sharePresence,
        })
      );
    },

    trackConversationPresence: async ({
      redis,
      connection,
      conversationId,
    }: {
      redis: ChatRedis;
      connection: ChatConnectionState;
      conversationId: string;
    }) => {
      await bridge.touchConnection({
        redis,
        connection,
      });

      const connectionRef = createConnectionRef(nodeId, connection.connectionId);
      const added = await redis.sadd(
        chatRealtimeKeys.conversationConnections(conversationId),
        connectionRef
      );

      if (added > 0 && connection.sharePresence) {
        const nextCount = await redis.hincrby(
          chatRealtimeKeys.conversationUsers(conversationId),
          connection.user.id,
          1
        );
        return nextCount === 1;
      }

      return false;
    },

    untrackConversationPresence: async ({
      redis,
      connection,
      conversationId,
    }: {
      redis: ChatRedis;
      connection: ChatConnectionState;
      conversationId: string;
    }) => {
      const connectionRef = createConnectionRef(nodeId, connection.connectionId);
      const removed = await redis.srem(
        chatRealtimeKeys.conversationConnections(conversationId),
        connectionRef
      );

      if (removed === 0 || !connection.sharePresence) {
        return false;
      }

      const nextCount = await redis.hincrby(
        chatRealtimeKeys.conversationUsers(conversationId),
        connection.user.id,
        -1
      );

      if (nextCount <= 0) {
        await redis.hdel(chatRealtimeKeys.conversationUsers(conversationId), connection.user.id);
        return true;
      }

      return false;
    },

    getConversationUsers: async ({
      redis,
      conversationId,
    }: {
      redis: ChatRedis;
      conversationId: string;
    }) => {
      const usersDict = await redis.hgetall(chatRealtimeKeys.conversationUsers(conversationId));
      return Object.keys(usersDict);
    },

    pruneConversationPresence: async ({
      redis,
      conversationId,
    }: {
      redis: ChatRedis;
      conversationId: string;
    }) => {
      const connectionRefs = await redis.smembers(
        chatRealtimeKeys.conversationConnections(conversationId)
      );

      const staleRefs: string[] = [];
      const userCounts = new Map<string, number>();

      for (const connectionRef of connectionRefs) {
        const parsed = parseConnectionRef(connectionRef);

        if (!parsed) {
          staleRefs.push(connectionRef);
          continue;
        }

        const rawMetadata = await redis.get(
          chatRealtimeKeys.connectionAlive(parsed.nodeId, parsed.connectionId)
        );

        if (!rawMetadata) {
          staleRefs.push(connectionRef);
          continue;
        }

        try {
          const metadata = JSON.parse(rawMetadata) as { userId?: string; sharePresence?: boolean };

          if (!metadata.userId) {
            staleRefs.push(connectionRef);
            continue;
          }

          if (metadata.sharePresence !== false) {
            userCounts.set(metadata.userId, (userCounts.get(metadata.userId) ?? 0) + 1);
          }
        } catch {
          staleRefs.push(connectionRef);
        }
      }

      if (staleRefs.length > 0) {
        await redis.srem(chatRealtimeKeys.conversationConnections(conversationId), ...staleRefs);
      }

      await redis.del(chatRealtimeKeys.conversationUsers(conversationId));

      if (userCounts.size > 0) {
        await redis.hset(
          chatRealtimeKeys.conversationUsers(conversationId),
          Object.fromEntries(userCounts.entries())
        );
      }
    },

    removeConnectionPresence: async ({
      redis,
      connection,
      conversationIds,
    }: {
      redis: ChatRedis;
      connection: ChatConnectionState;
      conversationIds: string[];
    }) => {
      const fullyDisconnectedConversationIds: string[] = [];
      
      for (const conversationId of conversationIds) {
        const isFullyDisconnected = await bridge.untrackConversationPresence({
          redis,
          connection,
          conversationId,
        });
        
        if (isFullyDisconnected) {
          fullyDisconnectedConversationIds.push(conversationId);
        }
      }

      await redis.del(chatRealtimeKeys.connectionAlive(nodeId, connection.connectionId));
      return fullyDisconnectedConversationIds;
    },

    claimMessageDeduplication: async ({
      redis,
      messageId,
    }: {
      redis: ChatRedis;
      messageId: string;
    }) => {
      const result = await redis.set(
        chatRealtimeKeys.messageDedupe(messageId),
        "1",
        "EX",
        messageDedupeTtlSeconds,
        "NX"
      );

      return result === "OK";
    },

    releaseMessageDeduplication: async ({
      redis,
      messageId,
    }: {
      redis: ChatRedis;
      messageId: string;
    }) => {
      await redis.del(chatRealtimeKeys.messageDedupe(messageId));
    },

    consumeMessageRateLimit: async ({
      redis,
      userId,
    }: {
      redis: ChatRedis;
      userId: string;
    }): Promise<ChatRateLimitResult> => {
      const result = await abuseService.consumePolicy({
        redis,
        policy: {
          ...abusePolicies.chatMessageSend,
          capacity: rateLimitCapacity,
          refillPerSecond: rateLimitRefillPerSecond,
        },
        subject: abuseService.createUserSubject(userId),
      });

      return {
        allowed: result.allowed,
        retryAfterMs: result.retryAfterMs,
      };
    },

    shutdown: async () => {
      if (subscriberStarted) {
        try {
          await subscriberClient?.unsubscribe(REALTIME_CHANNEL);
        } catch (error) {
          log.warn({ error }, "Failed to unsubscribe realtime bridge");
        }
      }

      if (subscriberHandlerBound) {
        subscriberClient?.removeListener("message", handleSubscriberMessage);
        subscriberHandlerBound = false;
      }

      subscriberStarted = false;
      updateRealtimeReadiness({ connected: false, subscribed: false });
      runtimeRef = null;
      publisherBound = new WeakSet();

      if (ownsSubscriber && subscriberClient) {
        await subscriberClient.quit();
        subscriberClient = null;
      }
    },

    getReadinessState: () => ({
      isConnected: subscriberConnected,
      isSubscribed: subscriberSubscribed,
    }),
  };

  return bridge;
};

export type ChatRealtimeBridge = ReturnType<typeof createChatRealtimeBridge>;

export const chatRealtimeBridge = createChatRealtimeBridge();
