import { z } from "@hono/zod-openapi";
import {
  e2eeMessageEnvelopeSchema,
  e2eePeerDeviceBundleSchema,
  e2eeSenderKeyEpochStateSchema,
} from "@/features/e2ee/schema";

export const chatWebSocketQuerySchema = z
  .object({
    token: z.string().min(10),
    sharePresence: z
      .string()
      .optional()
      .transform((val) => val === "true"),
  })
  .strict();

export const chatSocketEnvelopeSchema = z
  .object({
    type: z.string().min(1),
    requestId: z.string().min(1).optional(),
    data: z.unknown(),
  })
  .strict();

export const chatHeartbeatPingDataSchema = z.object({}).strict();

export const chatSubscriptionDataSchema = z
  .object({
    conversationId: z.string().uuid(),
  })
  .strict();

export const chatConversationParamsSchema = z
  .object({
    conversationId: z.string().uuid(),
  })
  .strict();

export const chatMessageParamsSchema = z
  .object({
    messageId: z.string().uuid(),
  })
  .strict();

export const chatMessageKindSchema = z.enum(["text", "image"]);

export const chatCiphertextSchema = e2eeMessageEnvelopeSchema;

export const chatMessageSendDataSchema = z
  .object({
    messageId: z.string().uuid(),
    conversationId: z.string().uuid(),
    kind: chatMessageKindSchema,
    ciphertext: chatCiphertextSchema,
    clientTimestamp: z.string().datetime({ offset: true }),
  })
  .strict();

export const chatDeliveryStatusSchema = z.enum(["delivered", "read"]);

export const chatTypingDataSchema = z
  .object({
    conversationId: z.string().uuid(),
  })
  .strict();

export const chatDeliveryAckDataSchema = z
  .object({
    messageId: z.string().uuid(),
    conversationId: z.string().uuid(),
    status: chatDeliveryStatusSchema,
    clientTimestamp: z.string().datetime({ offset: true }),
  })
  .strict();

export const chatSocketReadyDataSchema = z
  .object({
    connectionId: z.string().uuid(),
    sessionId: z.string().uuid(),
    user: z.object({
      id: z.string().uuid(),
      walletAddress: z.string(),
      role: z.string().nullable(),
      activeDeviceId: z.string().uuid(),
    }),
  })
  .strict();

export const chatSocketErrorDataSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().min(1).nullable().optional(),
    retryAfterMs: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const chatSocketPongDataSchema = z
  .object({
    timestamp: z.string(),
  })
  .strict();

export const chatSubscriptionAckDataSchema = z
  .object({
    conversationId: z.string().uuid(),
    conversationType: z.enum(["group", "direct"]).optional(),
  })
  .strict();

export const chatSubscriptionRestoredDataSchema = z
  .object({
    conversationIds: z.array(z.string().uuid()),
  })
  .strict();

export const chatMessageAcceptedDataSchema = z
  .object({
    messageId: z.string().uuid(),
    conversationId: z.string().uuid(),
    acceptedAt: z.string(),
  })
  .strict();

export const chatMessageRejectedDataSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    messageId: z.string().uuid().nullable().optional(),
    conversationId: z.string().uuid().nullable().optional(),
    requestId: z.string().min(1).nullable().optional(),
    retryAfterMs: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const chatDeliveryUpdatedDataSchema = z
  .object({
    messageId: z.string().uuid(),
    conversationId: z.string().uuid(),
    userId: z.string().uuid(),
    status: chatDeliveryStatusSchema,
    occurredAt: z.string(),
  })
  .strict();

export const chatHistoryQuerySchema = z
  .object({
    limit: z.coerce.number().int().positive().max(100).default(50),
    beforeMessageId: z.string().uuid().optional(),
  })
  .strict()
  .openapi("ChatHistoryQuery");

export const chatConversationSummarySchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(["group", "direct"]),
    createdBy: z.string().uuid(),
    createdAt: z.string(),
    updatedAt: z.string(),
    mutedUntil: z.string().nullable(),
    lastMessageId: z.string().uuid().nullable(),
    lastMessageAt: z.string().nullable(),
    lastMessageKind: chatMessageKindSchema.nullable(),
    lastMessageCiphertext: chatCiphertextSchema.nullable(),
    directPeer: z
      .object({
        userId: z.string().uuid(),
        walletAddress: z.string(),
        username: z.string().nullable(),
        displayName: z.string().nullable(),
        deviceBundles: z.array(e2eePeerDeviceBundleSchema),
      })
      .nullable(),
    groupState: z
      .object({
        memberCount: z.number().int().positive(),
        senderKeyState: e2eeSenderKeyEpochStateSchema.nullable(),
      })
      .nullable(),
  })
  .openapi("ChatConversationSummary");

export const chatMessageMutationSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      messageId: z.string().uuid(),
      conversationId: z.string().uuid(),
      deleted: z.boolean().optional(),
      hidden: z.boolean().optional(),
    }),
  })
  .openapi("ChatMessageMutationSuccessResponse");

export const chatConversationListDataSchema = z
  .object({
    conversations: z.array(chatConversationSummarySchema),
  })
  .openapi("ChatConversationListData");

export const chatConversationListSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: chatConversationListDataSchema,
  })
  .openapi("ChatConversationListSuccessResponse");

export const chatHistoryItemSchema = z
  .object({
    id: z.string().uuid(),
    conversationId: z.string().uuid(),
    senderId: z.string().uuid(),
    kind: chatMessageKindSchema,
    ciphertext: chatCiphertextSchema,
    createdAt: z.string(),
    editedAt: z.string().nullable(),
  })
  .openapi("ChatHistoryItem");

export const chatHistoryPageInfoSchema = z
  .object({
    limit: z.number().int().positive(),
    hasMore: z.boolean(),
    nextBeforeMessageId: z.string().uuid().nullable(),
  })
  .openapi("ChatHistoryPageInfo");

export const chatHistoryDataSchema = z
  .object({
    messages: z.array(chatHistoryItemSchema),
    pageInfo: chatHistoryPageInfoSchema,
  })
  .openapi("ChatHistoryData");

export const chatHistorySuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: chatHistoryDataSchema,
  })
  .openapi("ChatHistorySuccessResponse");
