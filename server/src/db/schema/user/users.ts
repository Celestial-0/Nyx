import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { userRoleEnum } from "@/db/schema/user/user.enums";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),

  walletAddress: text("wallet_address").notNull().unique(),
  username: text("username").unique(),
  fullName: text("full_name"),

  role: userRoleEnum("role").default("user"),
  isBanned: boolean("is_banned").default(false),

  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  usernameUpdatedAt: timestamp("username_updated_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
