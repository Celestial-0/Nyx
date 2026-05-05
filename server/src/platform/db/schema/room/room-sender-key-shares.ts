import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const roomSenderKeyShares = pgTable(
  "room_sender_key_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    epochId: uuid("epoch_id").notNull(),
    roomId: uuid("room_id").notNull(),
    userId: uuid("user_id").notNull(),
    deviceId: uuid("device_id").notNull(),
    createdByDeviceId: uuid("created_by_device_id").notNull(),
    encryptedShare: jsonb("encrypted_share").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("room_sender_key_shares_epoch_device_unique").on(table.epochId, table.deviceId),
    index("room_sender_key_shares_room_idx").on(table.roomId),
    index("room_sender_key_shares_device_idx").on(table.deviceId),
  ]
);
