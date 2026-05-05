import { pgTable, uuid, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const messageVisibility = pgTable("message_visibility", {
  
    id: uuid("id").primaryKey().defaultRandom(),

    messageId: uuid("message_id").notNull(),
    userId: uuid("user_id").notNull(),

    isHidden: boolean("is_hidden").default(false),

    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("message_visibility_message_user_unique").on(table.messageId, table.userId),
  ]
);
