import { pgEnum } from "drizzle-orm/pg-core";

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "confirmed",
  "failed",
]);
