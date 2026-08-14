import { z } from 'zod';

import { IsoDateStringSchema } from './common';

/**
 * End-to-end-encryption key material and device schemas.
 *
 * Ported 1:1 from the web client (`features/auth/auth.types.ts`). These are the
 * on-the-wire shapes only; the actual X25519 / sender-key crypto lives in
 * `lib/e2ee/e2ee.service.ts`.
 */

export const E2eeKeyTypeSchema = z.literal('x25519');

export const E2eeMessageAlgorithmSchema = z.enum([
  'signal-prekey-message-v1',
  'signal-sender-key-message-v1',
]);

export const E2eeSenderKeyAlgorithmSchema = z.literal('signal-sender-key-v1');

export const E2eeIdentityKeySchema = z.object({
  kty: E2eeKeyTypeSchema,
  publicKey: z.string().min(32).max(128),
});

export const E2eeSignedPreKeySchema = z.object({
  keyId: z.string().uuid(),
  kty: E2eeKeyTypeSchema,
  publicKey: z.string().min(32).max(128),
  signature: z.string().min(32).max(256),
  issuedAt: IsoDateStringSchema,
  expiresAt: IsoDateStringSchema.nullable().optional(),
});

export const E2eeOneTimePreKeySchema = z.object({
  keyId: z.string().uuid(),
  kty: E2eeKeyTypeSchema,
  publicKey: z.string().min(32).max(128),
});

export const E2eeDeviceRegistrationProofSchema = z.object({
  message: z.string().min(32).max(32_768),
  signature: z.string().min(32).max(256),
});

export const E2eeDeviceRegistrationSchema = z.object({
  deviceId: z.string().uuid(),
  identityKey: E2eeIdentityKeySchema,
  signedPreKey: E2eeSignedPreKeySchema,
  oneTimePreKeys: z.array(E2eeOneTimePreKeySchema).max(100),
  proof: E2eeDeviceRegistrationProofSchema,
});

export const E2eePreKeyInventoryStatusSchema = z.object({
  signedPreKeyRegistered: z.boolean(),
  oneTimePreKeysRemaining: z.number().int().nonnegative(),
  oneTimePreKeysLowWatermark: z.boolean(),
});

export const E2eeActiveDeviceSchema = z.object({
  deviceId: z.string().uuid(),
  fingerprint: z.string().min(8).max(64),
  identityKey: E2eeIdentityKeySchema,
  signedPreKey: E2eeSignedPreKeySchema,
  status: z.enum(['active', 'revoked']),
  registeredAt: IsoDateStringSchema,
  lastSeenAt: IsoDateStringSchema.nullable(),
  revokedAt: IsoDateStringSchema.nullable(),
});

export const E2eePeerDeviceBundleSchema = z.object({
  userId: z.string().uuid(),
  deviceId: z.string().uuid(),
  fingerprint: z.string().min(8).max(64),
  identityKey: E2eeIdentityKeySchema,
  signedPreKey: E2eeSignedPreKeySchema,
  oneTimePreKey: E2eeOneTimePreKeySchema.nullable(),
  registeredAt: IsoDateStringSchema,
});

export const E2eeSenderKeyShareCiphertextSchema = z.object({
  algorithm: E2eeSenderKeyAlgorithmSchema,
  ciphertext: z.string().min(16).max(4096),
  nonce: z.string().min(12).max(128),
  wrappedAt: IsoDateStringSchema,
});

export const E2eeSenderKeyEpochStateSchema = z.object({
  epochId: z.string().uuid(),
  roomId: z.string().uuid(),
  algorithm: E2eeSenderKeyAlgorithmSchema,
  status: z.enum(['pending', 'active', 'superseded']),
  createdByUserId: z.string().uuid(),
  createdByDeviceId: z.string().uuid().nullable(),
  createdAt: IsoDateStringSchema,
  activatedAt: IsoDateStringSchema.nullable(),
  distributionRequired: z.boolean(),
  activeDeviceShare: E2eeSenderKeyShareCiphertextSchema.nullable(),
});

export type E2eeKeyType = z.infer<typeof E2eeKeyTypeSchema>;
export type E2eeMessageAlgorithm = z.infer<typeof E2eeMessageAlgorithmSchema>;
export type E2eeSenderKeyAlgorithm = z.infer<typeof E2eeSenderKeyAlgorithmSchema>;
export type E2eeIdentityKey = z.infer<typeof E2eeIdentityKeySchema>;
export type E2eeSignedPreKey = z.infer<typeof E2eeSignedPreKeySchema>;
export type E2eeOneTimePreKey = z.infer<typeof E2eeOneTimePreKeySchema>;
export type E2eeDeviceRegistrationProof = z.infer<typeof E2eeDeviceRegistrationProofSchema>;
export type E2eeDeviceRegistration = z.infer<typeof E2eeDeviceRegistrationSchema>;
export type E2eePreKeyInventoryStatus = z.infer<typeof E2eePreKeyInventoryStatusSchema>;
export type E2eeActiveDevice = z.infer<typeof E2eeActiveDeviceSchema>;
export type E2eePeerDeviceBundle = z.infer<typeof E2eePeerDeviceBundleSchema>;
export type E2eeSenderKeyShareCiphertext = z.infer<typeof E2eeSenderKeyShareCiphertextSchema>;
export type E2eeSenderKeyEpochState = z.infer<typeof E2eeSenderKeyEpochStateSchema>;
