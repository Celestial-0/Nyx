import { z } from 'zod';

import { IsoDateStringSchema, WalletAddressSchema } from './common';
import {
  E2eeActiveDeviceSchema,
  E2eeDeviceRegistrationSchema,
  E2eePreKeyInventoryStatusSchema,
} from './e2ee';

/**
 * Wallet-signature auth flow schemas (nonce -> verify -> refresh / session).
 * Ported from the web client's `features/auth/auth.types.ts`.
 */

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const NonceRequestSchema = z.object({
  walletAddress: WalletAddressSchema,
});

export const VerifyRequestSchema = z.object({
  walletAddress: WalletAddressSchema,
  nonce: z.string().min(8).max(128),
  message: z.string().min(10).max(1024),
  signature: z.string().min(32).max(256),
  device: E2eeDeviceRegistrationSchema.optional(),
});

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(16),
  device: E2eeDeviceRegistrationSchema.optional(),
});

export const UpdateProfileSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  fullName: z.string().min(2).max(60).optional(),
});

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export const AuthSessionUserSchema = z.object({
  id: z.string(),
  walletAddress: z.string(),
  role: z.string().nullable(),
  activeDeviceId: z.string(),
});

export const NonceResponseSchema = z.object({
  walletAddress: z.string(),
  nonce: z.string(),
  message: z.string(),
  issuedAt: IsoDateStringSchema,
  expiresAt: IsoDateStringSchema,
});

export const VerifyResponseSchema = z.object({
  verified: z.boolean(),
  firstSignIn: z.boolean(),
  deviceRegistrationRequired: z.boolean(),
  profile: z.object({
    walletAddress: z.string(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
    profileComplete: z.boolean(),
  }),
  activeDevice: E2eeActiveDeviceSchema.nullable(),
  prekeyStatus: E2eePreKeyInventoryStatusSchema.nullable(),
  accessToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
  tokenType: z.literal('Bearer').nullable(),
  expiresIn: z.number().int().positive().nullable(),
});

export const RefreshResponseSchema = z.object({
  activeDevice: E2eeActiveDeviceSchema,
  prekeyStatus: E2eePreKeyInventoryStatusSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
});

export const SessionResponseSchema = z.object({
  authenticated: z.boolean(),
  user: AuthSessionUserSchema.nullable(),
  activeDevice: E2eeActiveDeviceSchema.nullable(),
  prekeyStatus: E2eePreKeyInventoryStatusSchema.nullable(),
});

export type NonceRequest = z.infer<typeof NonceRequestSchema>;
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileSchema>;
export type AuthSessionUser = z.infer<typeof AuthSessionUserSchema>;
export type NonceResponse = z.infer<typeof NonceResponseSchema>;
export type VerifyResponse = z.infer<typeof VerifyResponseSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
