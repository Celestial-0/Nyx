import { pgTable, uuid, integer, text, timestamp } from "drizzle-orm/pg-core";

export const creditLogs = pgTable("credit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id").notNull(),
  change: integer("change").notNull(),
  reason: text("reason").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
