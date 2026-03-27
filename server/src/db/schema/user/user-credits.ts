import { pgTable, uuid, integer, timestamp } from "drizzle-orm/pg-core";

export const userCredits = pgTable("user_credits", {
  userId: uuid("user_id").primaryKey(),

  balance: integer("balance").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
