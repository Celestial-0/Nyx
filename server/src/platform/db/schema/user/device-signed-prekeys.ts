import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const deviceSignedPrekeys = pgTable("device_signed_prekeys", {
  deviceId: uuid("device_id").primaryKey(),
  keyId: uuid("key_id").notNull(),
  publicKey: text("public_key").notNull(),
  signature: text("signature").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
