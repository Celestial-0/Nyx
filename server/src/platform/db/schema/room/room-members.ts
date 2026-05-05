import {
  pgTable,
  uuid,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { roomMemberRoleEnum } from "@/platform/db/schema/room/room.enums";

export const roomMembers = pgTable(
  "room_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    roomId: uuid("room_id").notNull(),
    userId: uuid("user_id").notNull(),

    role: roomMemberRoleEnum("role").default("member"),

    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),

    mutedUntil: timestamp("muted_until", { withTimezone: true }),

    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // 🔥 composite unique index (room + user)
    uniqueIndex("room_user_unique").on(
      table.roomId,
      table.userId
    ),
  ]
);
