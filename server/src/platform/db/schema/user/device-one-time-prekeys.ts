import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const deviceOneTimePrekeys = pgTable(
  "device_one_time_prekeys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id").notNull(),
    keyId: uuid("key_id").notNull(),
    publicKey: text("public_key").notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedByUserId: uuid("consumed_by_user_id"),
    consumedForConversationId: uuid("consumed_for_conversation_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("device_one_time_prekeys_device_key_unique").on(table.deviceId, table.keyId),
    index("device_one_time_prekeys_device_idx").on(table.deviceId),
    index("device_one_time_prekeys_consumed_idx").on(table.consumedAt),
  ]
);
