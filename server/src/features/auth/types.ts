import type { z } from "zod";
import type { db } from "@/platform/db/client";
import type { EventBusLike } from "@/platform/events/types";
import type { authEventSchemas } from "@/features/auth/events/schema";
import type { jwtService } from "@/security/jwt";
import type { redis } from "@/platform/redis/client";
import type {
  authNonceRequestBodySchema,
  authRefreshRequestBodySchema,
  authSignoutRequestBodySchema,
  authUpdateProfileBodySchema,
  authVerifyRequestBodySchema,
} from "@/features/auth/schema";
import type {
  e2eeActiveDeviceSchema,
  e2eePreKeyInventoryStatusSchema,
} from "@/features/e2ee/schema";

export type AuthenticatedUser = {
  id: string;
  walletAddress: string;
  role: string | null;
  sessionId: string;
  tokenId: string;
  activeDeviceId: string;
  activeDevice: z.infer<typeof e2eeActiveDeviceSchema>;
  prekeyStatus: z.infer<typeof e2eePreKeyInventoryStatusSchema>;
};

export type AuthSessionTokenPayload = {
  sub: string;
  wal: string;
  role: string | null;
  iss: string;
  aud: string;
  ver: number;
  jti: string;
  sessionId: string;
  did: string;
  type: "access" | "refresh";
  exp: number;
};

export type AuthRedis = Pick<
  typeof redis,
  "get" | "set" | "setex" | "del" | "sadd" | "smembers" | "expire"
>;

export type AuthDb = typeof db;
export type AuthJwt = typeof jwtService;

export type AuthEventName = keyof typeof authEventSchemas;
export type AuthEventPayload<K extends AuthEventName = AuthEventName> = z.infer<
  (typeof authEventSchemas)[K]
>;

export type AuthEventBus = EventBusLike<typeof authEventSchemas>;

export type GenerateNonceInput = z.infer<typeof authNonceRequestBodySchema>;
export type VerifyNonceInput = z.infer<typeof authVerifyRequestBodySchema>;
export type RefreshInput = z.infer<typeof authRefreshRequestBodySchema>;
export type SignoutInput = z.infer<typeof authSignoutRequestBodySchema>;
export type CompleteProfileBodyInput = z.infer<typeof authUpdateProfileBodySchema>;
export type CompleteProfileInput = CompleteProfileBodyInput & { walletAddress: string };

export type NonceRecord = {
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
};

export type AccessSessionRecord = {
  userId: string;
  walletAddress: string;
  role: string | null;
  sessionId: string;
  refreshTokenId: string;
  deviceId: string;
  tokenVersion: number;
  createdAt: string;
};

export type RefreshSessionRecord = {
  userId: string;
  walletAddress: string;
  role: string | null;
  sessionId: string;
  deviceId: string;
  tokenVersion: number;
  createdAt: string;
};
