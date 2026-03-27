import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";

export const userBlocks = pgTable("user_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),

  blockerId: uuid("blocker_id").notNull(),
  blockedId: uuid("blocked_id").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
