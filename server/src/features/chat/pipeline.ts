import { and, asc, eq, gte, inArray, isNull, lt, ne } from "drizzle-orm";
import { db as appDb } from "@/platform/db/client";
import { messageDelivery, messages, roomMembers, rooms } from "@/platform/db/schema";
import { getMessageRetentionCutoff } from "@/features/chat/retention";
import { chatEventTopics } from "@/features/chat/events/topics";
import {
  debitUserBalance,
  MESSAGE_SEND_CREDITS,
} from "@/features/payments/ledger";
import type {
  ChatDb,
  ChatEventBus,
  ChatEventPayload,
  ChatMessageKind,
} from "@/features/chat/types";
import { AppError, Conflict } from "@/shared/error";
import { logger } from "@/shared/logger";

const log = logger.child({ module: "chat.pipeline" });
const registeredPipelines = new WeakSet<object>();
const pendingReplayLimit = 100;
const replayableMessageTypes = ["text", "image"] as const;

const storeSubmittedMessage = async ({
  db,
  payload,
}: {
  db: ChatDb;
  payload: ChatEventPayload<typeof chatEventTopics.messageSubmitted>;
}) => {
  const createdAt = new Date();
  const retentionCutoff = getMessageRetentionCutoff(createdAt);

  try {
    return await db.transaction(async (tx) => {
      await debitUserBalance({
        db: tx as never,
        userId: payload.senderId,
        credits: MESSAGE_SEND_CREDITS,
        reason: "message_send",
      });

      const insertedMessages = await tx
        .insert(messages)
        .values({
          id: payload.messageId,
          roomId: payload.conversationId,
          senderId: payload.senderId,
          content: payload.ciphertext,
          type: payload.kind,
          createdAt,
        })
        .returning({
          id: messages.id,
          roomId: messages.roomId,
          senderId: messages.senderId,
          content: messages.content,
          type: messages.type,
          createdAt: messages.createdAt,
        });

      const insertedMessage = insertedMessages[0];

      if (!insertedMessage) {
        throw new AppError({
          message: "Failed to persist message.",
        });
      }

      const updatedRooms = await tx
        .update(rooms)
        .set({
          lastMessageId: insertedMessage.id,
          lastMessageAt: createdAt,
          updatedAt: createdAt,
        })
        .where(eq(rooms.id, payload.conversationId))
        .returning({
          id: rooms.id,
        });

      if (!updatedRooms[0]) {
        throw new AppError({
          message: "Failed to update conversation metadata.",
        });
      }

      const recipients = await tx
        .select({
          userId: roomMembers.userId,
        })
        .from(roomMembers)
        .where(
          and(
            eq(roomMembers.roomId, payload.conversationId),
            isNull(roomMembers.leftAt),
            ne(roomMembers.userId, payload.senderId)
          )
        );

      if (recipients.length > 0) {
        await tx
          .insert(messageDelivery)
          .values(
            recipients.map(({ userId }) => ({
              messageId: insertedMessage.id,
              userId,
              status: "sent" as const,
              updatedAt: createdAt,
            }))
          )
          .onConflictDoNothing();
      }

      await tx
        .delete(messages)
        .where(
          and(
            eq(messages.roomId, payload.conversationId),
            isNull(messages.deletedAt),
            lt(messages.createdAt, retentionCutoff)
          )
        );

      return {
        messageId: insertedMessage.id,
        conversationId: insertedMessage.roomId,
        senderId: insertedMessage.senderId!,
        kind: payload.kind,
        ciphertext: insertedMessage.content as typeof payload.ciphertext,
        createdAt: (insertedMessage.createdAt ?? createdAt).toISOString(),
      };
    });
  } catch (error) {
    const dbError = error as {
      code?: string;
      message?: string;
      cause?: { code?: string; message?: string };
    };
    const duplicateCode = dbError.code ?? dbError.cause?.code;
    const duplicateMessage = dbError.message ?? dbError.cause?.message ?? "";

    if (
      duplicateCode === "23505" ||
      /messages_pkey|duplicate key/i.test(duplicateMessage)
    ) {
      throw Conflict("Message already exists for this messageId.");
    }

    throw error;
  }
};

const handleMessageSubmitted = async ({
  db,
  eventBus,
  payload,
}: {
  db: ChatDb;
  eventBus: ChatEventBus;
  payload: ChatEventPayload<typeof chatEventTopics.messageSubmitted>;
}) => {
  const storedMessage = await storeSubmittedMessage({
    db,
    payload,
  });

  await eventBus.emit(chatEventTopics.messageCreated, storedMessage);
};

export const registerChatMessagePipeline = ({
  eventBus,
  db = appDb,
}: {
  eventBus: ChatEventBus;
  db?: ChatDb;
}) => {
  if (registeredPipelines.has(eventBus)) {
    return () => {};
  }

  const unsubscribe = eventBus.on(
    chatEventTopics.messageSubmitted,
    async (payload) => {
      try {
        await handleMessageSubmitted({
          db,
          eventBus,
          payload,
        });
      } catch (error) {
        if (error instanceof AppError) {
          log.warn({ payload, error }, "Submitted message was rejected");
        } else {
          log.error({ payload, error }, "Failed to process submitted message");
        }
        throw error;
      }
    }
  );

  registeredPipelines.add(eventBus);

  return () => {
    unsubscribe();
    registeredPipelines.delete(eventBus);
  };
};

export const loadPendingConversationDeliveries = async ({
  db,
  userId,
  conversationId,
  limit = pendingReplayLimit,
}: {
  db: ChatDb;
  userId: string;
  conversationId: string;
  limit?: number;
}) => {
  const retentionCutoff = getMessageRetentionCutoff();

  const rows = await db
    .select({
      messageId: messages.id,
      conversationId: messages.roomId,
      senderId: messages.senderId,
      kind: messages.type,
      ciphertext: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messageDelivery)
    .innerJoin(messages, eq(messageDelivery.messageId, messages.id))
    .where(
      and(
        eq(messageDelivery.userId, userId),
        eq(messageDelivery.status, "sent"),
        eq(messages.roomId, conversationId),
        isNull(messages.deletedAt),
        gte(messages.createdAt, retentionCutoff),
        inArray(messages.type, replayableMessageTypes)
      )
    )
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .limit(limit);

  return rows.map((row) => ({
    messageId: row.messageId,
    conversationId: row.conversationId,
    senderId: row.senderId!,
    kind: (row.kind ?? "text") as ChatMessageKind,
    ciphertext: row.ciphertext as ChatEventPayload<typeof chatEventTopics.messageCreated>["ciphertext"],
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  }));
};
