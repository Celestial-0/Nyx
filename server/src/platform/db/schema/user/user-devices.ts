import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userDeviceStatusEnum } from "@/platform/db/schema/user/user.enums";

export const userDevices = pgTable(
  "user_devices",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    identityKey: jsonb("identity_key").notNull(),
    registrationMessage: text("registration_message").notNull(),
    registrationSignature: text("registration_signature").notNull(),
    fingerprint: text("fingerprint").notNull(),
    status: userDeviceStatusEnum("status").notNull().default("active"),
    registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("user_devices_user_idx").on(table.userId),
    index("user_devices_status_idx").on(table.status),
  ]
);
