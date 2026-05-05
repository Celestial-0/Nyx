import { pgTable, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { messageStatusEnum } from "@/platform/db/schema/message/message.enums";

export const messageDelivery = pgTable("message_delivery", {
  
    id: uuid("id").primaryKey().defaultRandom(),

    messageId: uuid("message_id").notNull(),
    userId: uuid("user_id").notNull(),

    status: messageStatusEnum("status").notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("message_delivery_message_user_unique").on(table.messageId, table.userId),
  ]
);
