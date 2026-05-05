import {
  pgTable,
  uuid,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { messageTypeEnum } from "@/platform/db/schema/message/message.enums";

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    roomId: uuid("room_id").notNull(),
    senderId: uuid("sender_id"),

    content: jsonb("content").notNull(),

    type: messageTypeEnum("type").default("text"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),

    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("messages_room_idx").on(table.roomId),
    index("messages_created_idx").on(table.createdAt),
  ]
);
