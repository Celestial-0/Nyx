import {
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  index,
  text,
} from "drizzle-orm/pg-core";

export const userContacts = pgTable(
  "user_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id").notNull(),
    contactUserId: uuid("contact_user_id").notNull(),
    alias: text("alias"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("user_contacts_owner_contact_unique").on(
      table.ownerUserId,
      table.contactUserId
    ),
    index("user_contacts_owner_idx").on(table.ownerUserId),
    index("user_contacts_contact_idx").on(table.contactUserId),
  ]
);
