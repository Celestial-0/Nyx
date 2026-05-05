import type { z } from "zod";
import type { db } from "@/platform/db/client";
import type { EventBusLike } from "@/platform/events/types";
import type { paymentEventSchemas } from "@/features/payments/events/schema";
import type {
  paymentRechargeVerifyBodySchema,
} from "@/features/payments/schema";
import type { redis } from "@/platform/redis/client";

export type PaymentsDb = typeof db;
export type PaymentsRedis = Pick<typeof redis, "get" | "set" | "setex" | "del" | "expire">;

export type PaymentsEventName = keyof typeof paymentEventSchemas;
export type PaymentsEventPayload<K extends PaymentsEventName = PaymentsEventName> = z.infer<
  (typeof paymentEventSchemas)[K]
>;
export type PaymentsEventBus = EventBusLike<typeof paymentEventSchemas>;

export type PaymentRechargeVerifyInput = z.infer<typeof paymentRechargeVerifyBodySchema>;

export type CreditLedgerReason =
  | "initial_grant"
  | "recharge"
  | "room_creation"
  | "message_send";

export type SolanaTransferVerification = {
  amountSol: string;
  lamports: bigint;
  transactionHash: string;
};
