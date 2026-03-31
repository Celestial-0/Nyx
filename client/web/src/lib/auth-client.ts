/**
 * COMPATIBILITY RE-EXPORT LAYER
 * 
 * This file re-exports from the new API modules for backward compatibility.
 * During migration, existing imports from @/lib/auth-client will continue to work.
 * After Phase 5, this file should be deleted and imports migrated.
 */

// Re-export all types
export type {
  NonceRequest,
  NonceResponse,
  VerifyRequest,
  VerifyResponse,
  RefreshRequest,
  RefreshResponse,
  SessionResponse,
  UpdateProfileRequest,
  UserProfile,
} from "@lib/api/auth/types";

// Re-export Zod schemas
export {
  NonceRequestSchema,
  VerifyRequestSchema,
  RefreshRequestSchema,
  UpdateProfileSchema,
  NonceResponseSchema,
  VerifyResponseSchema,
  RefreshResponseSchema,
  SessionResponseSchema,
  UserProfileSchema,
} from "@/api/auth/types";

// Re-export token helpers
export {
  getAccessToken,
  getRefreshToken,
  setTokens,
  setAccessToken,
  clearTokens,
} from "@/api/auth/tokens";

// Re-export pure API client functions
export {
  requestNonce,
  verifySignature,
  refreshAccessToken,
  validateSession,
  signOut,
  getMyProfile,
  updateProfile,
} from "@/lib/api/auth";
