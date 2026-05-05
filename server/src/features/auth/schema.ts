import { z } from "@hono/zod-openapi";
import {
  e2eeActiveDeviceSchema,
  e2eeDeviceRegistrationSchema,
  e2eePreKeyInventoryStatusSchema,
} from "@/features/e2ee/schema";

export const solanaAddressSchema = z
  .string()
  .min(32)
  .max(44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana wallet address.");

const base58ValueSchema = (label: string, min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, `Invalid ${label}.`);

export const authNonceRequestBodySchema = z
  .object({
    walletAddress: solanaAddressSchema,
  })
  .strict();

export const authVerifyRequestBodySchema = z
  .object({
    walletAddress: solanaAddressSchema,
    nonce: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/, "Invalid nonce."),
    message: z.string().min(10).max(1024),
    signature: base58ValueSchema("signature", 32, 256),
    device: e2eeDeviceRegistrationSchema.optional(),
  })
  .strict();

export const authRefreshRequestBodySchema = z
  .object({
    refreshToken: z.string().min(16),
    device: e2eeDeviceRegistrationSchema.optional(),
  })
  .strict();

export const authSignoutRequestBodySchema = z
  .object({
    revokeDevice: z.boolean().optional(),
  })
  .strict();

export const authUpdateProfileBodySchema = z
  .object({
    username: z.string().min(3).max(30),
    fullName: z.string().min(2).max(60),
  })
  .strict();

export const authNonceDataSchema = z
  .object({
    walletAddress: z.string(),
    nonce: z.string(),
    message: z.string(),
    issuedAt: z.string(),
    expiresAt: z.string(),
  })
  .openapi("AuthNonceData");

export const authNonceSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: authNonceDataSchema,
  })
  .openapi("AuthNonceSuccessResponse");

export const authVerifyDataSchema = z
  .object({
    verified: z.boolean(),
    firstSignIn: z.boolean(),
    deviceRegistrationRequired: z.boolean(),
    profile: z.object({
      walletAddress: z.string(),
      username: z.string().nullable(),
      displayName: z.string().nullable(),
      profileComplete: z.boolean(),
    }),
    activeDevice: e2eeActiveDeviceSchema.nullable(),
    prekeyStatus: e2eePreKeyInventoryStatusSchema.nullable(),
    accessToken: z.string().nullable(),
    refreshToken: z.string().nullable(),
    tokenType: z.literal("Bearer").nullable(),
    expiresIn: z.number().int().positive().nullable(),
  })
  .openapi("AuthVerifyData");

export const authVerifySuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: authVerifyDataSchema,
  })
  .openapi("AuthVerifySuccessResponse");

export const authRefreshDataSchema = z
  .object({
    activeDevice: e2eeActiveDeviceSchema,
    prekeyStatus: e2eePreKeyInventoryStatusSchema,
    accessToken: z.string(),
    refreshToken: z.string(),
    tokenType: z.literal("Bearer"),
    expiresIn: z.number().int().positive(),
  })
  .openapi("AuthRefreshData");

export const authRefreshSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: authRefreshDataSchema,
  })
  .openapi("AuthRefreshSuccessResponse");

export const authSessionUserSchema = z
  .object({
    id: z.string().uuid(),
    walletAddress: z.string(),
    role: z.string().nullable(),
    activeDeviceId: z.string().uuid(),
  })
  .openapi("AuthSessionUser");

export const authSessionSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      authenticated: z.boolean(),
      user: authSessionUserSchema.nullable(),
      activeDevice: e2eeActiveDeviceSchema.nullable(),
      prekeyStatus: e2eePreKeyInventoryStatusSchema.nullable(),
    }),
  })
  .openapi("AuthSessionSuccessResponse");

export const authSignoutSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      signedOut: z.literal(true),
      revokedDeviceId: z.string().uuid().nullable(),
    }),
  })
  .openapi("AuthSignoutSuccessResponse");
