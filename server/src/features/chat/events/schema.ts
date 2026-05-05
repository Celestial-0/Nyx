import { z } from "zod";
import { chatEventTopics } from "@/features/chat/events/topics";
import {
  chatCiphertextSchema,
  chatDeliveryStatusSchema,
  chatMessageKindSchema,
} from "@/features/chat/schema";

const conversationContextSchema = z.object({
  conversationId: z.string().uuid(),
});

export const chatEventSchemas = {
  [chatEventTopics.messageSubmitted]: z
    .object({
      messageId: z.string().uuid(),
      conversationId: z.string().uuid(),
      senderId: z.string().uuid(),
      kind: chatMessageKindSchema,
      ciphertext: chatCiphertextSchema,
      clientTimestamp: z.string(),
      submittedAt: z.string(),
    })
    .strict(),
  [chatEventTopics.messageCreated]: z
    .object({
      messageId: z.string().uuid(),
      senderId: z.string().uuid(),
      kind: chatMessageKindSchema,
      ciphertext: chatCiphertextSchema,
      createdAt: z.string(),
    })
    .and(conversationContextSchema),
  [chatEventTopics.deliveryUpdated]: z
    .object({
      messageId: z.string().uuid(),
      senderId: z.string().uuid(),
      userId: z.string().uuid(),
      status: chatDeliveryStatusSchema,
      occurredAt: z.string(),
    })
    .and(conversationContextSchema),
  [chatEventTopics.messageDeleted]: z
    .object({
      id: z.string(),
    })
    .and(conversationContextSchema),
  [chatEventTopics.messageRead]: z
    .object({
      messageId: z.string(),
      userId: z.string(),
    })
    .and(conversationContextSchema),
  [chatEventTopics.userOnline]: z.object({
    userId: z.string(),
    conversationId: z.string(),
  }),
  [chatEventTopics.userOffline]: z.object({
    userId: z.string(),
    conversationId: z.string(),
  }),
  [chatEventTopics.typingStarted]: z
    .object({
      userId: z.string(),
    })
    .and(conversationContextSchema),
  [chatEventTopics.typingStopped]: z
    .object({
      userId: z.string(),
    })
    .and(conversationContextSchema),
} as const;
