import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { senderKeyEpochStatusEnum } from "@/platform/db/schema/room/room.enums";

export const roomSenderKeyEpochs = pgTable(
  "room_sender_key_epochs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id").notNull(),
    algorithm: text("algorithm").notNull(),
    status: senderKeyEpochStatusEnum("status").notNull().default("pending"),
    createdByUserId: uuid("created_by_user_id").notNull(),
    createdByDeviceId: uuid("created_by_device_id"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("room_sender_key_epochs_room_idx").on(table.roomId),
    index("room_sender_key_epochs_status_idx").on(table.status),
  ]
);
