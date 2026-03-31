import type { z } from "zod";

import type { db } from "@/db/client";
import type { eventSchemas } from "@/events/schemas";
import type { redis } from "@/redis/client";
import type { jwtPlugin } from "@/plugins/jwt.plugin";

import type {
  authNonceRequestBodySchema,
  authProfileCompleteRequestBodySchema,
  authRefreshRequestBodySchema,
  authVerifyRequestBodySchema,
} from "@/modules/auth/auth.schema";


export type AuthenticatedUser = {
  id: string;
  walletAddress: string;
  role: string | null;
  sessionId: string;
};

export type AuthSessionTokenPayload = {
  sub: string;
  wal: string;
  role: string | null;
  jti: string;
  type: "access" | "refresh";
  exp: number;
};

export type AuthMacroOption = boolean | { optional?: boolean };

export type AuthRedis = Pick<
  typeof redis,
  "get" | "setex" | "del" | "sadd" | "smembers" | "srem" | "expire"
>;

export type AuthDb = typeof db;

export type AuthJwt = typeof jwtPlugin.decorator.jwt;

export type AuthEventName = keyof typeof eventSchemas;

export type AuthEventPayload<K extends AuthEventName = AuthEventName> = z.infer<
  (typeof eventSchemas)[K]
>;

export type AuthEventBus = {
  emit: <K extends AuthEventName>(event: K, payload: AuthEventPayload<K>) => Promise<void>;
};

export type GenerateNonceInput = typeof authNonceRequestBodySchema.static;
export type VerifyNonceInput = typeof authVerifyRequestBodySchema.static;
export type RefreshInput = typeof authRefreshRequestBodySchema.static;
export type CompleteProfileBodyInput = typeof authProfileCompleteRequestBodySchema.static;
export type CompleteProfileInput = CompleteProfileBodyInput & { walletAddress: string };

export type NonceRecord = {
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
};

export type ResolveAuthContext = {
  headers: Record<string, string | undefined>;
  jwt: AuthJwt;
  redis: AuthRedis;
  db: AuthDb;
};

export type ResolveAuthUserFn = (ctx: ResolveAuthContext) => Promise<AuthenticatedUser | null>;
