import type { z } from "zod";
import type { db } from "@/platform/db/client";
import type { eventBus } from "@/platform/events";
import type { chatEventSchemas } from "@/features/chat/events/schema";
import type { AuthenticatedUser } from "@/features/auth/types";
import type {
  chatDeliveryAckDataSchema,
  chatDeliveryStatusSchema,
  chatDeliveryUpdatedDataSchema,
  chatCiphertextSchema,
  chatMessageParamsSchema,
  chatConversationParamsSchema,
  chatConversationListSuccessResponseSchema,
  chatHeartbeatPingDataSchema,
  chatHistoryItemSchema,
  chatHistoryPageInfoSchema,
  chatHistoryQuerySchema,
  chatHistorySuccessResponseSchema,
  chatMessageAcceptedDataSchema,
  chatMessageKindSchema,
  chatMessageRejectedDataSchema,
  chatMessageSendDataSchema,
  chatSocketEnvelopeSchema,
  chatSocketErrorDataSchema,
  chatSocketPongDataSchema,
  chatSocketReadyDataSchema,
  chatSubscriptionAckDataSchema,
  chatSubscriptionDataSchema,
  chatSubscriptionRestoredDataSchema,
  chatTypingDataSchema,
} from "@/features/chat/schema";
import type { jwtService } from "@/security/jwt";
import type { redis } from "@/platform/redis/client";

export type ChatDb = typeof db;
export type ChatJwt = typeof jwtService;
export type ChatEventBus = typeof eventBus;
export type ChatRedis = typeof redis;

export type ChatSocketEnvelope = z.infer<typeof chatSocketEnvelopeSchema>;
export type ChatHeartbeatPingData = z.infer<typeof chatHeartbeatPingDataSchema>;
export type ChatSubscriptionData = z.infer<typeof chatSubscriptionDataSchema>;
export type ChatConversationParams = z.infer<typeof chatConversationParamsSchema>;
export type ChatMessageParams = z.infer<typeof chatMessageParamsSchema>;
export type ChatMessageSendData = z.infer<typeof chatMessageSendDataSchema>;
export type ChatDeliveryAckData = z.infer<typeof chatDeliveryAckDataSchema>;
export type ChatDeliveryStatus = z.infer<typeof chatDeliveryStatusSchema>;
export type ChatMessageKind = z.infer<typeof chatMessageKindSchema>;
export type ChatCiphertext = z.infer<typeof chatCiphertextSchema>;
export type ChatTypingData = z.infer<typeof chatTypingDataSchema>;
export type ChatHistoryQuery = z.infer<typeof chatHistoryQuerySchema>;
export type ChatHistoryItem = z.infer<typeof chatHistoryItemSchema>;
export type ChatHistoryPageInfo = z.infer<typeof chatHistoryPageInfoSchema>;
export type ChatHistorySuccessResponse = z.infer<typeof chatHistorySuccessResponseSchema>;
export type ChatConversationListSuccessResponse = z.infer<typeof chatConversationListSuccessResponseSchema>;
export type ChatSocketReadyData = z.infer<typeof chatSocketReadyDataSchema>;
export type ChatSocketErrorData = z.infer<typeof chatSocketErrorDataSchema>;
export type ChatSocketPongData = z.infer<typeof chatSocketPongDataSchema>;
export type ChatSubscriptionAckData = z.infer<typeof chatSubscriptionAckDataSchema>;
export type ChatSubscriptionRestoredData = z.infer<typeof chatSubscriptionRestoredDataSchema>;
export type ChatMessageAcceptedData = z.infer<typeof chatMessageAcceptedDataSchema>;
export type ChatMessageRejectedData = z.infer<typeof chatMessageRejectedDataSchema>;
export type ChatDeliveryUpdatedData = z.infer<typeof chatDeliveryUpdatedDataSchema>;

export type ChatSocketMessageType =
  | "ws:heartbeat:ping"
  | "ws:heartbeat:pong"
  | "ws:connection:ready"
  | "ws:connection:error"
  | "chat:message:send"
  | "chat:message:accepted"
  | "chat:message:rejected"
  | "chat:delivery:ack"
  | "chat:delivery:updated"
  | "chat:subscription:add"
  | "chat:subscription:remove"
  | "chat:subscription:added"
  | "chat:subscription:removed"
  | "chat:subscription:restored"
  | "chat:typing:start"
  | "chat:typing:stop";

export type ChatSocketFrame<TData = unknown> = {
  type: string;
  requestId?: string;
  data: TData;
};

export type ChatSocket = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

export type ChatConnectionState = {
  connectionId: string;
  socket: ChatSocket;
  user: AuthenticatedUser;
  subscriptions: Set<string>;
  sharePresence: boolean;
};

export type ChatGatewayRuntime = {
  connections: Map<string, ChatConnectionState>;
  conversationConnections: Map<string, Set<string>>;
  eventBindingsInitialized: boolean;
};

export type ChatRateLimitResult = {
  allowed: boolean;
  retryAfterMs: number | null;
};

export type ChatRealtimeEnvelope = {
  originNodeId: string;
  event: string;
  conversationId: string;
  payload: unknown;
};

export type ChatEventName = keyof typeof chatEventSchemas;
export type ChatEventPayload<K extends ChatEventName = ChatEventName> = z.infer<
  (typeof chatEventSchemas)[K]
>;
