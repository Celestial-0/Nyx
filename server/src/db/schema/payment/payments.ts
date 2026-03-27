import { pgTable, uuid, numeric, integer, text, timestamp } from "drizzle-orm/pg-core";
import { paymentStatusEnum } from "@/db/schema/payment/payment.enums";

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id").notNull(),

  amountSol: numeric("amount_sol").notNull(),
  creditsGranted: integer("credits_granted").notNull(),

  transactionHash: text("tx_hash").unique(),
  network: text("network"),

  status: paymentStatusEnum("status").notNull(),

  verifiedAt: timestamp("verified_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
