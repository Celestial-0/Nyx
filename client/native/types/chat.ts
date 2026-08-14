import { z } from 'zod';

import { IsoDateStringSchema } from './common';
import {
  E2eeMessageAlgorithmSchema,
  E2eePeerDeviceBundleSchema,
  E2eeSenderKeyAlgorithmSchema,
  E2eeSenderKeyEpochStateSchema,
  E2eeSenderKeyShareCiphertextSchema,
} from './e2ee';
import { RoomDetailSchema, RoomMemberSchema, RoomMembershipSchema, RoomSummarySchema, RoomTypeSchema } from './rooms';

/** Chat conversation / message / realtime schemas. Ported from web `features/chat`. */

export const ChatMemberStatusSchema = z.enum(['verified', 'limited']);
export const ChatLoadStateSchema = z.enum(['idle', 'loading', 'ready', 'error']);
export const ChatConnectionStateSchema = z.enum([
  'idle',
  'connecting',
  'connected',
  'disconnected',
  'error',
]);
export const ChatMessageKindSchema = z.enum(['text', 'image']);
export const ChatMessageDeliveryStateSchema = z.enum([
  'sending',
  'stored',
  'delivered',
  'read',
  'rejected',
]);

// ---------------------------------------------------------------------------
// Ciphertext envelopes
// ---------------------------------------------------------------------------

export const ChatDirectRecipientSchema = z.object({
  deviceId: z.string(),
  preKeyId: z.string(),
  oneTimePreKeyId: z.string().nullable(),
  encryptedMessageKey: z.string(),
});

export const ChatSenderKeyDistributionShareSchema = z.object({
  userId: z.string(),
  deviceId: z.string(),
  encryptedShare: E2eeSenderKeyShareCiphertextSchema,
});

export const ChatSenderKeyDistributionSchema = z.object({
  epochId: z.string(),
  algorithm: E2eeSenderKeyAlgorithmSchema,
  shares: z.array(ChatSenderKeyDistributionShareSchema),
});

export const ChatDirectMessageEnvelopeSchema = z.object({
  version: z.literal('1'),
  algorithm: z.literal('signal-prekey-message-v1'),
  conversationType: z.literal('direct'),
  senderDeviceId: z.string(),
  ciphertext: z.string(),
  nonce: z.string(),
  sentAt: IsoDateStringSchema,
  recipients: z.array(ChatDirectRecipientSchema),
});

export const ChatGroupMessageEnvelopeSchema = z.object({
  version: z.literal('1'),
  algorithm: z.literal('signal-sender-key-message-v1'),
  conversationType: z.literal('group'),
  senderDeviceId: z.string(),
  ciphertext: z.string(),
  nonce: z.string(),
  sentAt: IsoDateStringSchema,
  senderKeyEpochId: z.string(),
  distribution: ChatSenderKeyDistributionSchema.nullable().optional(),
});

export const ChatCiphertextEnvelopeSchema = z.discriminatedUnion('algorithm', [
  ChatDirectMessageEnvelopeSchema,
  ChatGroupMessageEnvelopeSchema,
]);

// ---------------------------------------------------------------------------
// Conversation list + history (server responses)
// ---------------------------------------------------------------------------

export const ChatConversationSummarySchema = z.object({
  id: z.string(),
  type: RoomTypeSchema,
  createdBy: z.string(),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
  mutedUntil: IsoDateStringSchema.nullable(),
  lastMessageId: z.string().nullable(),
  lastMessageAt: IsoDateStringSchema.nullable(),
  lastMessageKind: ChatMessageKindSchema.nullable(),
  lastMessageCiphertext: ChatCiphertextEnvelopeSchema.nullable(),
  directPeer: z
    .object({
      userId: z.string(),
      walletAddress: z.string(),
      username: z.string().nullable(),
      displayName: z.string().nullable(),
      deviceBundles: z.array(E2eePeerDeviceBundleSchema),
    })
    .nullable(),
  groupState: z
    .object({
      memberCount: z.number(),
      senderKeyState: E2eeSenderKeyEpochStateSchema.nullable(),
    })
    .nullable(),
});

export const ChatConversationListResponseSchema = z.object({
  conversations: z.array(ChatConversationSummarySchema),
});

export const ChatHistoryQuerySchema = z.object({
  limit: z.number().optional(),
  beforeMessageId: z.string().optional(),
});

export const ChatHistoryItemSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  kind: ChatMessageKindSchema,
  ciphertext: ChatCiphertextEnvelopeSchema,
  createdAt: IsoDateStringSchema,
  editedAt: IsoDateStringSchema.nullable(),
});

export const ChatHistoryPageInfoSchema = z.object({
  limit: z.number(),
  hasMore: z.boolean(),
  nextBeforeMessageId: z.string().nullable(),
});

export const ChatHistoryResponseSchema = z.object({
  messages: z.array(ChatHistoryItemSchema),
  pageInfo: ChatHistoryPageInfoSchema,
});

// ---------------------------------------------------------------------------
// Client-side view models (computed, not directly from the server)
// ---------------------------------------------------------------------------

export const ChatConversationSchema = z.object({
  id: z.string(),
  type: RoomTypeSchema,
  room: RoomSummarySchema,
  name: z.string(),
  description: z.string(),
  searchValue: z.string(),
  avatarSrc: z.string(),
  lastMessageAt: IsoDateStringSchema.nullable(),
  lastMessageKind: ChatMessageKindSchema.nullable(),
  lastMessagePreview: z.string(),
  lastMessagePreviewFallback: z.boolean(),
  lastActivityLabel: z.string(),
  unreadCount: z.number(),
  memberCount: z.number(),
  mutedUntil: IsoDateStringSchema.nullable(),
  directPeer: ChatConversationSummarySchema.shape.directPeer,
  senderKeyState: E2eeSenderKeyEpochStateSchema.nullable(),
});

export const ChatMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  walletAddress: z.string(),
  username: z.string().nullable(),
  role: z.string(),
  memberRole: z.enum(['admin', 'member']).nullable(),
  status: ChatMemberStatusSchema,
  avatarSrc: z.string(),
  deviceCount: z.number(),
});

export const ChatConversationContextSchema = z.object({
  room: RoomSummarySchema,
  membership: RoomMembershipSchema.nullable(),
  senderKeyState: E2eeSenderKeyEpochStateSchema.nullable(),
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  kind: ChatMessageKindSchema,
  ciphertext: ChatCiphertextEnvelopeSchema,
  createdAt: IsoDateStringSchema,
  editedAt: IsoDateStringSchema.nullable(),
  previewText: z.string(),
  previewFallback: z.boolean(),
  deliveryState: ChatMessageDeliveryStateSchema,
  algorithm: E2eeMessageAlgorithmSchema,
  senderDeviceId: z.string(),
  canDeleteForEveryone: z.boolean().optional(),
});

export const ChatConversationResourceSchema = z.object({
  summary: ChatConversationSummarySchema,
  detail: RoomDetailSchema.nullable().optional(),
  members: z.array(RoomMemberSchema).optional(),
});

// ---------------------------------------------------------------------------
// Realtime socket frames (outgoing request + incoming server frames)
// ---------------------------------------------------------------------------

export const ChatSocketRequestTypeSchema = z.enum([
  'ws:heartbeat:ping',
  'chat:subscription:add',
  'chat:subscription:remove',
  'chat:typing:start',
  'chat:typing:stop',
  'chat:delivery:ack',
  'chat:message:send',
]);

/** Outgoing frame the client sends over the socket. */
export type ChatSocketRequest<TData = unknown> = {
  type: z.infer<typeof ChatSocketRequestTypeSchema>;
  requestId?: string;
  data: TData;
};

export const ChatServerFrameTypeSchema = z.enum([
  'ws:connection:ready',
  'ws:connection:error',
  'ws:heartbeat:pong',
  'chat:subscription:restored',
  'chat:subscription:added',
  'chat:subscription:removed',
  'chat:message:accepted',
  'chat:message:rejected',
  'chat:message:created',
  'chat:delivery:updated',
  'chat:message:deleted',
  'presence:typing:started',
  'presence:typing:stopped',
  'presence:user:online',
  'presence:user:offline',
]);

/**
 * A lightweight, forward-compatible realtime frame. The `type` is validated;
 * `data` stays `unknown` and is narrowed by the socket handler per frame type
 * (mirrors the permissive `parseFrame` in the web client's `chat.ws.ts`).
 */
export const ChatRealtimeFrameSchema = z.object({
  type: z.string(),
  requestId: z.string().optional(),
  data: z.unknown(),
});

export type ChatMemberStatus = z.infer<typeof ChatMemberStatusSchema>;
export type ChatLoadState = z.infer<typeof ChatLoadStateSchema>;
export type ChatConnectionState = z.infer<typeof ChatConnectionStateSchema>;
export type ChatMessageKind = z.infer<typeof ChatMessageKindSchema>;
export type ChatMessageDeliveryState = z.infer<typeof ChatMessageDeliveryStateSchema>;
export type ChatDirectRecipient = z.infer<typeof ChatDirectRecipientSchema>;
export type ChatSenderKeyDistribution = z.infer<typeof ChatSenderKeyDistributionSchema>;
export type ChatDirectMessageEnvelope = z.infer<typeof ChatDirectMessageEnvelopeSchema>;
export type ChatGroupMessageEnvelope = z.infer<typeof ChatGroupMessageEnvelopeSchema>;
export type ChatCiphertextEnvelope = z.infer<typeof ChatCiphertextEnvelopeSchema>;
export type ChatConversationSummary = z.infer<typeof ChatConversationSummarySchema>;
export type ChatConversationListResponse = z.infer<typeof ChatConversationListResponseSchema>;
export type ChatHistoryQuery = z.infer<typeof ChatHistoryQuerySchema>;
export type ChatHistoryItem = z.infer<typeof ChatHistoryItemSchema>;
export type ChatHistoryPageInfo = z.infer<typeof ChatHistoryPageInfoSchema>;
export type ChatHistoryResponse = z.infer<typeof ChatHistoryResponseSchema>;
export type ChatConversation = z.infer<typeof ChatConversationSchema>;
export type ChatMember = z.infer<typeof ChatMemberSchema>;
export type ChatConversationContext = z.infer<typeof ChatConversationContextSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatConversationResource = z.infer<typeof ChatConversationResourceSchema>;
export type ChatRealtimeFrame = z.infer<typeof ChatRealtimeFrameSchema>;
