import { z } from "@hono/zod-openapi";

const base58ValueSchema = (label: string, min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, `Invalid ${label}.`);

export const e2eeKeyTypeSchema = z.enum(["x25519"]);
export const e2eeEnvelopeVersionSchema = z.literal("1");
export const e2eeMessageAlgorithmSchema = z.enum([
  "signal-prekey-message-v1",
  "signal-sender-key-message-v1",
]);
export const e2eeSenderKeyAlgorithmSchema = z.literal("signal-sender-key-v1");

export const e2eePublicKeySchema = base58ValueSchema("public key", 32, 128);
export const e2eeCiphertextBlobSchema = base58ValueSchema("ciphertext", 16, 4096);
export const e2eeNonceSchema = base58ValueSchema("nonce", 12, 128);
export const e2eeSignatureSchema = base58ValueSchema("signature", 32, 256);

export const e2eeIdentityKeySchema = z
  .object({
    kty: e2eeKeyTypeSchema,
    publicKey: e2eePublicKeySchema,
  })
  .strict()
  .openapi("E2eeIdentityKey");

export const e2eeSignedPreKeySchema = z
  .object({
    keyId: z.string().uuid(),
    kty: e2eeKeyTypeSchema,
    publicKey: e2eePublicKeySchema,
    signature: e2eeSignatureSchema,
    issuedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict()
  .openapi("E2eeSignedPreKey");

export const e2eeOneTimePreKeySchema = z
  .object({
    keyId: z.string().uuid(),
    kty: e2eeKeyTypeSchema,
    publicKey: e2eePublicKeySchema,
  })
  .strict()
  .openapi("E2eeOneTimePreKey");

export const e2eeDeviceRegistrationProofSchema = z
  .object({
    message: z.string().min(32).max(32_768),
    signature: e2eeSignatureSchema,
  })
  .strict()
  .openapi("E2eeDeviceRegistrationProof");

export const e2eeDeviceRegistrationSchema = z
  .object({
    deviceId: z.string().uuid(),
    identityKey: e2eeIdentityKeySchema,
    signedPreKey: e2eeSignedPreKeySchema,
    oneTimePreKeys: z.array(e2eeOneTimePreKeySchema).max(100),
    proof: e2eeDeviceRegistrationProofSchema,
  })
  .strict()
  .openapi("E2eeDeviceRegistration");

export const e2eePreKeyInventoryStatusSchema = z
  .object({
    signedPreKeyRegistered: z.boolean(),
    oneTimePreKeysRemaining: z.number().int().nonnegative(),
    oneTimePreKeysLowWatermark: z.boolean(),
  })
  .strict()
  .openapi("E2eePreKeyInventoryStatus");

export const e2eeActiveDeviceSchema = z
  .object({
    deviceId: z.string().uuid(),
    fingerprint: z.string().min(8).max(64),
    identityKey: e2eeIdentityKeySchema,
    signedPreKey: e2eeSignedPreKeySchema,
    status: z.enum(["active", "revoked"]),
    registeredAt: z.string().datetime({ offset: true }),
    lastSeenAt: z.string().datetime({ offset: true }).nullable(),
    revokedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict()
  .openapi("E2eeActiveDevice");

export const e2eePeerDeviceBundleSchema = z
  .object({
    userId: z.string().uuid(),
    deviceId: z.string().uuid(),
    fingerprint: z.string().min(8).max(64),
    identityKey: e2eeIdentityKeySchema,
    signedPreKey: e2eeSignedPreKeySchema,
    oneTimePreKey: e2eeOneTimePreKeySchema.nullable(),
    registeredAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .openapi("E2eePeerDeviceBundle");

export const e2eeSenderKeyShareCiphertextSchema = z
  .object({
    algorithm: e2eeSenderKeyAlgorithmSchema,
    ciphertext: e2eeCiphertextBlobSchema,
    nonce: e2eeNonceSchema,
    wrappedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .openapi("E2eeSenderKeyShareCiphertext");

export const e2eeSenderKeyDistributionShareSchema = z
  .object({
    userId: z.string().uuid(),
    deviceId: z.string().uuid(),
    encryptedShare: e2eeSenderKeyShareCiphertextSchema,
  })
  .strict()
  .openapi("E2eeSenderKeyDistributionShare");

export const e2eeSenderKeyDistributionSchema = z
  .object({
    epochId: z.string().uuid(),
    algorithm: e2eeSenderKeyAlgorithmSchema,
    shares: z.array(e2eeSenderKeyDistributionShareSchema).max(500),
  })
  .strict()
  .openapi("E2eeSenderKeyDistribution");

export const e2eeSenderKeyEpochStateSchema = z
  .object({
    epochId: z.string().uuid(),
    roomId: z.string().uuid(),
    algorithm: e2eeSenderKeyAlgorithmSchema,
    status: z.enum(["pending", "active", "superseded"]),
    createdByUserId: z.string().uuid(),
    createdByDeviceId: z.string().uuid().nullable(),
    createdAt: z.string().datetime({ offset: true }),
    activatedAt: z.string().datetime({ offset: true }).nullable(),
    distributionRequired: z.boolean(),
    activeDeviceShare: e2eeSenderKeyShareCiphertextSchema.nullable(),
  })
  .strict()
  .openapi("E2eeSenderKeyEpochState");

const e2eeMessageEnvelopeBaseSchema = z
  .object({
    version: e2eeEnvelopeVersionSchema,
    algorithm: e2eeMessageAlgorithmSchema,
    senderDeviceId: z.string().uuid(),
    ciphertext: e2eeCiphertextBlobSchema,
    nonce: e2eeNonceSchema,
    sentAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const e2eeDirectRecipientSchema = z
  .object({
    deviceId: z.string().uuid(),
    preKeyId: z.string().uuid(),
    oneTimePreKeyId: z.string().uuid().nullable(),
    encryptedMessageKey: e2eeCiphertextBlobSchema,
  })
  .strict()
  .openapi("E2eeDirectRecipient");

export const e2eeDirectMessageEnvelopeSchema = e2eeMessageEnvelopeBaseSchema
  .extend({
    algorithm: z.literal("signal-prekey-message-v1"),
    conversationType: z.literal("direct"),
    recipients: z.array(e2eeDirectRecipientSchema).min(1).max(50),
  })
  .strict()
  .openapi("E2eeDirectMessageEnvelope");

export const e2eeGroupMessageEnvelopeSchema = e2eeMessageEnvelopeBaseSchema
  .extend({
    algorithm: z.literal("signal-sender-key-message-v1"),
    conversationType: z.literal("group"),
    senderKeyEpochId: z.string().uuid(),
    distribution: e2eeSenderKeyDistributionSchema.nullable().optional(),
  })
  .strict()
  .openapi("E2eeGroupMessageEnvelope");

export const e2eeMessageEnvelopeSchema = z
  .union([e2eeDirectMessageEnvelopeSchema, e2eeGroupMessageEnvelopeSchema])
  .openapi("E2eeMessageEnvelope");
