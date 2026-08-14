import { z } from 'zod';

/**
 * Shared primitive schemas reused across every domain.
 *
 * These mirror the server contract used by the web client. Because React
 * Native (Hermes) does not always expose `crypto.randomUUID`, the id helpers
 * here degrade gracefully instead of assuming a browser environment.
 */

/** ISO-8601 timestamp string (the server always sends strings, never Date). */
export const IsoDateStringSchema = z.string();

/** UUID v4 as returned by the server. */
export const UuidSchema = z.string().uuid();

/** Base58/hex-ish wallet address (Solana addresses are 32-44 chars). */
export const WalletAddressSchema = z.string().min(32).max(44);

/**
 * Generate a request id. Prefers `crypto.randomUUID` when the runtime provides
 * it, otherwise falls back to a timestamp+random token (parity with web).
 */
export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `nyx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Envelope the server wraps every successful JSON response in. */
export const ApiSuccessEnvelopeSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.literal(true),
    data,
  });

/** Envelope the server wraps every error response in. */
export const ApiErrorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type IsoDateString = z.infer<typeof IsoDateStringSchema>;
export type Uuid = z.infer<typeof UuidSchema>;
export type WalletAddress = z.infer<typeof WalletAddressSchema>;
