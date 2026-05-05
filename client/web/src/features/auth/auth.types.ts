import { z } from "zod"

export type E2eeKeyType = "x25519"
export type E2eeMessageAlgorithm =
  | "signal-prekey-message-v1"
  | "signal-sender-key-message-v1"
export type E2eeSenderKeyAlgorithm = "signal-sender-key-v1"

export type E2eeIdentityKey = {
  kty: E2eeKeyType
  publicKey: string
}

export type E2eeSignedPreKey = {
  keyId: string
  kty: E2eeKeyType
  publicKey: string
  signature: string
  issuedAt: string
  expiresAt?: string | null
}

export type E2eeOneTimePreKey = {
  keyId: string
  kty: E2eeKeyType
  publicKey: string
}

export type E2eeDeviceRegistrationProof = {
  message: string
  signature: string
}

export type E2eeDeviceRegistration = {
  deviceId: string
  identityKey: E2eeIdentityKey
  signedPreKey: E2eeSignedPreKey
  oneTimePreKeys: E2eeOneTimePreKey[]
  proof: E2eeDeviceRegistrationProof
}

export type E2eePreKeyInventoryStatus = {
  signedPreKeyRegistered: boolean
  oneTimePreKeysRemaining: number
  oneTimePreKeysLowWatermark: boolean
}

export type E2eeActiveDevice = {
  deviceId: string
  fingerprint: string
  identityKey: E2eeIdentityKey
  signedPreKey: E2eeSignedPreKey
  status: "active" | "revoked"
  registeredAt: string
  lastSeenAt: string | null
  revokedAt: string | null
}

export type E2eePeerDeviceBundle = {
  userId: string
  deviceId: string
  fingerprint: string
  identityKey: E2eeIdentityKey
  signedPreKey: E2eeSignedPreKey
  oneTimePreKey: E2eeOneTimePreKey | null
  registeredAt: string
}

export type E2eeSenderKeyShareCiphertext = {
  algorithm: E2eeSenderKeyAlgorithm
  ciphertext: string
  nonce: string
  wrappedAt: string
}

export type E2eeSenderKeyEpochState = {
  epochId: string
  roomId: string
  algorithm: E2eeSenderKeyAlgorithm
  status: "pending" | "active" | "superseded"
  createdByUserId: string
  createdByDeviceId: string | null
  createdAt: string
  activatedAt: string | null
  distributionRequired: boolean
  activeDeviceShare: E2eeSenderKeyShareCiphertext | null
}

export type AuthSessionUser = {
  id: string
  walletAddress: string
  role: string | null
  activeDeviceId: string
}

export type NonceRequest = {
  walletAddress: string
}

export const NonceRequestSchema = z.object({
  walletAddress: z.string().min(32).max(44),
})

export type VerifyRequest = {
  walletAddress: string
  nonce: string
  message: string
  signature: string
  device?: E2eeDeviceRegistration
}

export const E2eeIdentityKeySchema: z.ZodType<E2eeIdentityKey> = z.object({
  kty: z.literal("x25519"),
  publicKey: z.string().min(32).max(128),
})

export const E2eeSignedPreKeySchema: z.ZodType<E2eeSignedPreKey> = z.object({
  keyId: z.string().uuid(),
  kty: z.literal("x25519"),
  publicKey: z.string().min(32).max(128),
  signature: z.string().min(32).max(256),
  issuedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
})

export const E2eeOneTimePreKeySchema: z.ZodType<E2eeOneTimePreKey> = z.object({
  keyId: z.string().uuid(),
  kty: z.literal("x25519"),
  publicKey: z.string().min(32).max(128),
})

export const E2eeDeviceRegistrationProofSchema: z.ZodType<E2eeDeviceRegistrationProof> =
  z.object({
    message: z.string().min(32).max(32_768),
    signature: z.string().min(32).max(256),
  })

export const E2eeDeviceRegistrationSchema: z.ZodType<E2eeDeviceRegistration> =
  z.object({
    deviceId: z.string().uuid(),
    identityKey: E2eeIdentityKeySchema,
    signedPreKey: E2eeSignedPreKeySchema,
    oneTimePreKeys: z.array(E2eeOneTimePreKeySchema).max(100),
    proof: E2eeDeviceRegistrationProofSchema,
  })

export const E2eePreKeyInventoryStatusSchema: z.ZodType<E2eePreKeyInventoryStatus> =
  z.object({
    signedPreKeyRegistered: z.boolean(),
    oneTimePreKeysRemaining: z.number().int().nonnegative(),
    oneTimePreKeysLowWatermark: z.boolean(),
  })

export const E2eeActiveDeviceSchema: z.ZodType<E2eeActiveDevice> = z.object({
  deviceId: z.string().uuid(),
  fingerprint: z.string().min(8).max(64),
  identityKey: E2eeIdentityKeySchema,
  signedPreKey: E2eeSignedPreKeySchema,
  status: z.enum(["active", "revoked"]),
  registeredAt: z.string(),
  lastSeenAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
})

export const E2eePeerDeviceBundleSchema: z.ZodType<E2eePeerDeviceBundle> = z.object({
  userId: z.string().uuid(),
  deviceId: z.string().uuid(),
  fingerprint: z.string().min(8).max(64),
  identityKey: E2eeIdentityKeySchema,
  signedPreKey: E2eeSignedPreKeySchema,
  oneTimePreKey: E2eeOneTimePreKeySchema.nullable(),
  registeredAt: z.string(),
})

export const E2eeSenderKeyShareCiphertextSchema: z.ZodType<E2eeSenderKeyShareCiphertext> =
  z.object({
    algorithm: z.literal("signal-sender-key-v1"),
    ciphertext: z.string().min(16).max(4096),
    nonce: z.string().min(12).max(128),
    wrappedAt: z.string(),
  })

export const E2eeSenderKeyEpochStateSchema: z.ZodType<E2eeSenderKeyEpochState> =
  z.object({
    epochId: z.string().uuid(),
    roomId: z.string().uuid(),
    algorithm: z.literal("signal-sender-key-v1"),
    status: z.enum(["pending", "active", "superseded"]),
    createdByUserId: z.string().uuid(),
    createdByDeviceId: z.string().uuid().nullable(),
    createdAt: z.string(),
    activatedAt: z.string().nullable(),
    distributionRequired: z.boolean(),
    activeDeviceShare: E2eeSenderKeyShareCiphertextSchema.nullable(),
  })

export const VerifyRequestSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  nonce: z.string().min(8).max(128),
  message: z.string().min(10).max(1024),
  signature: z.string().min(32).max(256),
  device: E2eeDeviceRegistrationSchema.optional(),
})

export type RefreshRequest = {
  refreshToken: string
  device?: E2eeDeviceRegistration
}

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(16),
  device: E2eeDeviceRegistrationSchema.optional(),
})

export type UpdateProfileRequest = {
  username?: string
  fullName?: string
}

export const UpdateProfileSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  fullName: z.string().min(2).max(60).optional(),
})

export type NonceResponse = {
  walletAddress: string
  nonce: string
  message: string
  issuedAt: string
  expiresAt: string
}

export const NonceResponseSchema: z.ZodType<NonceResponse> = z.object({
  walletAddress: z.string(),
  nonce: z.string(),
  message: z.string(),
  issuedAt: z.string(),
  expiresAt: z.string(),
})

export type VerifyResponse = {
  verified: boolean
  firstSignIn: boolean
  deviceRegistrationRequired: boolean
  profile: {
    walletAddress: string
    username: string | null
    displayName: string | null
    profileComplete: boolean
  }
  activeDevice: E2eeActiveDevice | null
  prekeyStatus: E2eePreKeyInventoryStatus | null
  accessToken: string | null
  refreshToken: string | null
  tokenType: "Bearer" | null
  expiresIn: number | null
}

export const VerifyResponseSchema: z.ZodType<VerifyResponse> = z.object({
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
  tokenType: z.literal("Bearer").nullable(),
  expiresIn: z.number().int().positive().nullable(),
})

export type RefreshResponse = {
  activeDevice: E2eeActiveDevice
  prekeyStatus: E2eePreKeyInventoryStatus
  accessToken: string
  refreshToken: string
  tokenType: "Bearer"
  expiresIn: number
}

export const RefreshResponseSchema: z.ZodType<RefreshResponse> = z.object({
  activeDevice: E2eeActiveDeviceSchema,
  prekeyStatus: E2eePreKeyInventoryStatusSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int().positive(),
})

export type SessionResponse = {
  authenticated: boolean
  user: AuthSessionUser | null
  activeDevice: E2eeActiveDevice | null
  prekeyStatus: E2eePreKeyInventoryStatus | null
}

export const SessionResponseSchema: z.ZodType<SessionResponse> = z.object({
  authenticated: z.boolean(),
  user: z
    .object({
      id: z.string(),
      walletAddress: z.string(),
      role: z.string().nullable(),
      activeDeviceId: z.string(),
    })
    .nullable(),
  activeDevice: E2eeActiveDeviceSchema.nullable(),
  prekeyStatus: E2eePreKeyInventoryStatusSchema.nullable(),
})
