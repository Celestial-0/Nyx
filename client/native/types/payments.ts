import { z } from 'zod';

import { IsoDateStringSchema } from './common';

/** Solana credit / payment schemas. Ported from web `features/payments`. */

export const PaymentPricingSchema = z.object({
  creditsPerSol: z.number(),
  defaultInitialCredits: z.number(),
  messageSendCredits: z.number(),
  groupRoomCreateCredits: z.number(),
});

export const PaymentTreasurySchema = z.object({
  walletAddress: z.string(),
});

export const PaymentNetworkSchema = z.object({
  chain: z.literal('solana'),
  rpcUrl: z.string(),
  commitment: z.string(),
});

export const PaymentRechargeActivitySchema = z.object({
  id: z.string(),
  transactionHash: z.string(),
  amountSol: z.string(),
  creditsGranted: z.number(),
  status: z.literal('confirmed'),
  network: z.string().nullable(),
  verifiedAt: IsoDateStringSchema.nullable(),
  createdAt: IsoDateStringSchema.nullable(),
});

export const PaymentCreditActivitySchema = z.object({
  id: z.string(),
  change: z.number(),
  reason: z.string(),
  createdAt: IsoDateStringSchema.nullable(),
});

export const PaymentCreditsSnapshotSchema = z.object({
  balance: z.number(),
  pricing: PaymentPricingSchema,
  treasury: PaymentTreasurySchema,
  network: PaymentNetworkSchema,
  recentRecharges: z.array(PaymentRechargeActivitySchema),
  recentActivity: z.array(PaymentCreditActivitySchema),
});

export const PaymentRechargeVerifyResponseSchema = z.object({
  transactionHash: z.string(),
  amountSol: z.string(),
  creditsGranted: z.number(),
  balance: z.number(),
  status: z.literal('confirmed'),
});

export const PaymentsPanelSourceSchema = z.enum([
  'sidebar',
  'profile',
  'settings',
  'message-send',
  'group-create',
]);

export const PaymentRechargeStateSchema = z.enum([
  'idle',
  'sending',
  'verifying',
  'success',
  'error',
]);

export type PaymentPricing = z.infer<typeof PaymentPricingSchema>;
export type PaymentTreasury = z.infer<typeof PaymentTreasurySchema>;
export type PaymentNetwork = z.infer<typeof PaymentNetworkSchema>;
export type PaymentRechargeActivity = z.infer<typeof PaymentRechargeActivitySchema>;
export type PaymentCreditActivity = z.infer<typeof PaymentCreditActivitySchema>;
export type PaymentCreditsSnapshot = z.infer<typeof PaymentCreditsSnapshotSchema>;
export type PaymentRechargeVerifyResponse = z.infer<typeof PaymentRechargeVerifyResponseSchema>;
export type PaymentsPanelSource = z.infer<typeof PaymentsPanelSourceSchema>;
export type PaymentRechargeState = z.infer<typeof PaymentRechargeStateSchema>;
