import { z } from "zod";

/**
 * Auth Types and Zod Schemas
 * Canonical type definitions for frontend auth contracts
 */

// ============== REQUEST TYPES ==============

export type NonceRequest = {
  walletAddress: string;
};

export const NonceRequestSchema = z.object({
  walletAddress: z.string().min(32).max(44),
});

export type VerifyRequest = {
  walletAddress: string;
  nonce: string;
  message: string;
  signature: string;
};

export const VerifyRequestSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  nonce: z.string().min(8).max(128),
  message: z.string().min(10).max(1024),
  signature: z.string().min(32).max(256),
});

export type RefreshRequest = {
  refreshToken: string;
};

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(16),
});

export type UpdateProfileRequest = {
  username?: string;
  displayName?: string;
};

export const UpdateProfileSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  displayName: z.string().min(2).max(60).optional(),
});

// ============== RESPONSE TYPES ==============

export type NonceResponse = {
  walletAddress: string;
  nonce: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
};

export const NonceResponseSchema: z.ZodType<NonceResponse> = z.object({
  walletAddress: z.string(),
  nonce: z.string(),
  message: z.string(),
  issuedAt: z.string(),
  expiresAt: z.string(),
});

export type VerifyResponse = {
  verified: boolean;
  firstSignIn: boolean;
  profile: {
    walletAddress: string;
    username: string | null;
    displayName: string | null;
    profileComplete: boolean;
  };
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

export const VerifyResponseSchema: z.ZodType<VerifyResponse> = z.object({
  verified: z.boolean(),
  firstSignIn: z.boolean(),
  profile: z.object({
    walletAddress: z.string(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
    profileComplete: z.boolean(),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int().positive(),
});

export type RefreshResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

export const RefreshResponseSchema: z.ZodType<RefreshResponse> = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int().positive(),
});

export type SessionResponse = {
  authenticated: boolean;
  user: {
    id: string;
    walletAddress: string;
    role: string | null;
  } | null;
};

export const SessionResponseSchema: z.ZodType<SessionResponse> = z.object({
  authenticated: z.boolean(),
  user: z
    .object({
      id: z.string(),
      walletAddress: z.string(),
      role: z.string().nullable(),
    })
    .nullable(),
});

export type UserProfile = {
  id: string;
  walletAddress: string;
  username: string | null;
  displayName: string | null;
  fullName: string | null;
  isBanned: boolean;
};

export const UserProfileSchema: z.ZodType<UserProfile> = z.object({
  id: z.string(),
  walletAddress: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  fullName: z.string().nullable(),
  isBanned: z.boolean(),
});
