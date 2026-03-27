import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { messageStatusEnum } from "@/db/schema/message/message.enums";

export const messageDelivery = pgTable("message_delivery", {
  id: uuid("id").primaryKey().defaultRandom(),

  messageId: uuid("message_id").notNull(),
  userId: uuid("user_id").notNull(),

  status: messageStatusEnum("status").notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
