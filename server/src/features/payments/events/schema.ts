import { z } from "zod";
import { paymentEventTopics } from "@/features/payments/events/topics";

export const paymentEventSchemas = {
  [paymentEventTopics.transactionVerified]: z
    .object({
      userId: z.string().uuid(),
      transactionHash: z.string(),
      amountSol: z.string(),
      creditsGranted: z.number().int().positive(),
      balance: z.number().int().nonnegative(),
      verifiedAt: z.string(),
    })
    .strict(),
  [paymentEventTopics.transactionRejected]: z
    .object({
      userId: z.string().uuid(),
      transactionHash: z.string(),
      reason: z.string(),
      rejectedAt: z.string(),
    })
    .strict(),
} as const;
