import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { roomTypeEnum } from "@/db/schema/room/room.enums";

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    type: roomTypeEnum("type").notNull(),
    isDirect: boolean("is_direct").default(false),

    directKey: text("direct_key").notNull(),

    createdBy: uuid("created_by").notNull(),

    lastMessageId: uuid("last_message_id"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("direct_room_unique").on(table.directKey),
    index("rooms_last_message_idx").on(table.lastMessageAt),
  ]
);