import { z } from "@hono/zod-openapi";

export const paymentPricingSchema = z
  .object({
    creditsPerSol: z.number().positive(),
    defaultInitialCredits: z.number().int().nonnegative(),
    messageSendCredits: z.number().int().positive(),
    groupRoomCreateCredits: z.number().int().positive(),
  })
  .openapi("PaymentPricing");

export const paymentTreasurySchema = z
  .object({
    walletAddress: z.string().min(32).max(64),
  })
  .openapi("PaymentTreasury");

export const paymentNetworkSchema = z
  .object({
    chain: z.literal("solana"),
    rpcUrl: z.string().url(),
    commitment: z.string(),
  })
  .openapi("PaymentNetwork");

export const paymentRechargeActivitySchema = z
  .object({
    id: z.string().uuid(),
    transactionHash: z.string(),
    amountSol: z.string(),
    creditsGranted: z.number().int().positive(),
    status: z.literal("confirmed"),
    network: z.string().nullable(),
    verifiedAt: z.string().nullable(),
    createdAt: z.string().nullable(),
  })
  .openapi("PaymentRechargeActivity");

export const paymentCreditActivitySchema = z
  .object({
    id: z.string().uuid(),
    change: z.number().int(),
    reason: z.string(),
    createdAt: z.string().nullable(),
  })
  .openapi("PaymentCreditActivity");

export const paymentCreditsBalanceSchema = z
  .object({
    balance: z.number().int().nonnegative(),
    pricing: paymentPricingSchema,
    treasury: paymentTreasurySchema,
    network: paymentNetworkSchema,
    recentRecharges: z.array(paymentRechargeActivitySchema),
    recentActivity: z.array(paymentCreditActivitySchema),
  })
  .openapi("PaymentCreditsBalance");

export const paymentCreditsSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: paymentCreditsBalanceSchema,
  })
  .openapi("PaymentCreditsSuccessResponse");

export const paymentRechargeVerifyBodySchema = z
  .object({
    transactionHash: z
      .string()
      .min(32)
      .max(128)
      .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Invalid transaction hash."),
  })
  .strict();

export const paymentRechargeVerifyDataSchema = z
  .object({
    transactionHash: z.string(),
    amountSol: z.string(),
    creditsGranted: z.number().int().positive(),
    balance: z.number().int().nonnegative(),
    status: z.literal("confirmed"),
  })
  .openapi("PaymentRechargeVerifyData");

export const paymentRechargeVerifySuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: paymentRechargeVerifyDataSchema,
  })
  .openapi("PaymentRechargeVerifySuccessResponse");
