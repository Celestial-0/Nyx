import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { roomTypeEnum } from "@/platform/db/schema/room/room.enums";

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    type: roomTypeEnum("type").notNull(),
    directKey: text("direct_key"),

    createdBy: uuid("created_by").notNull(),

    lastMessageId: uuid("last_message_id"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("rooms_direct_key_unique")
      .on(table.directKey)
      .where(sql`${table.directKey} is not null`),
    index("rooms_last_message_idx").on(table.lastMessageAt),
  ]
);
