import { randomBytes, randomUUID } from "node:crypto";
import { TextEncoder } from "node:util";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { and, eq, isNull, ne } from "drizzle-orm";
import { env } from "@/config/env";
import { users } from "@/db/schema/user/users";
import type {
  AuthDb,
  AuthenticatedUser,
  AuthEventBus,
  AuthEventName,
  AuthEventPayload,
  AuthJwt,
  AuthRedis,
  AuthSessionTokenPayload,
  CompleteProfileInput,
  GenerateNonceInput,
  NonceRecord,
  RefreshInput,
  VerifyNonceInput,
} from "@/modules/auth/auth.types";
import { AppError, BadRequest, Forbidden } from "@/utils/error";
import { logger } from "@/utils/logger";

const log = logger.child({ module: "auth.service" });

const walletNonceKey = (walletAddress: string) => `auth:nonce:wallet:${walletAddress}`;
const noncePayloadKey = (nonce: string) => `auth:nonce:payload:${nonce}`;
const authSessionKey = (sessionId: string) => `auth:session:${sessionId}`;
const refreshSessionKey = (refreshSessionId: string) => `auth:refresh:${refreshSessionId}`;
const accessRefreshKey = (sessionId: string) => `auth:session:refresh:${sessionId}`;
const refreshAccessSetKey = (refreshSessionId: string) => `auth:refresh:access:${refreshSessionId}`;

const textEncoder = new TextEncoder();

const buildSiwsMessage = ({
  walletAddress,
  nonce,
  issuedAt,
  expiresAt,
}: NonceRecord) => {
  return [
    `${env.AUTH_SIWS_DOMAIN} wants you to sign in with your Solana account:`,
    walletAddress,
    "",
    env.AUTH_SIWS_STATEMENT,
    "",
    `URI: ${env.AUTH_SIWS_URI}`,
    "Version: 1",
    "Chain ID: solana:mainnet",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expiresAt}`,
  ].join("\n");
};

const createNonceRecord = (walletAddress: string): NonceRecord => {
  const now = new Date();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + env.AUTH_NONCE_TTL_SECONDS * 1000).toISOString();

  return {
    walletAddress,
    nonce: randomBytes(24).toString("base64url"),
    issuedAt,
    expiresAt,
  };
};

const parseRecord = (raw: string): NonceRecord | null => {
  try {
    return JSON.parse(raw) as NonceRecord;
  } catch {
    return null;
  }
};

const parseTokenPayload = (
  value: Awaited<ReturnType<AuthJwt["verify"]>>
): AuthSessionTokenPayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<AuthSessionTokenPayload>;
  if (
    typeof payload.sub !== "string" ||
    typeof payload.wal !== "string" ||
    (payload.role !== null && typeof payload.role !== "string" && payload.role !== undefined) ||
    typeof payload.jti !== "string" ||
    (payload.type !== "access" && payload.type !== "refresh") ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }

  return {
    sub: payload.sub,
    wal: payload.wal,
    role: payload.role ?? null,
    jti: payload.jti,
    type: payload.type,
    exp: payload.exp,
  };
};

const verifyWalletSignature = ({
  walletAddress,
  message,
  signature,
}: {
  walletAddress: string;
  message: string;
  signature: string;
}) => {
  try {
    const publicKey = bs58.decode(walletAddress);
    const signatureBytes = bs58.decode(signature);

    if (publicKey.length !== 32 || signatureBytes.length !== 64) {
      return false;
    }

    return nacl.sign.detached.verify(
      textEncoder.encode(message),
      signatureBytes,
      publicKey
    );
  } catch {
    return false;
  }
};

const signToken = async (jwt: AuthJwt, payload: AuthSessionTokenPayload) => {
  const token = await jwt.sign(payload);
  if (typeof token !== "string" || token.length === 0) {
    throw BadRequest("Failed to sign auth token.");
  }

  return token;
};

const issueAccessSessionToken = async ({
  jwt,
  redisClient,
  user,
  refreshSessionId,
}: {
  jwt: AuthJwt;
  redisClient: AuthRedis;
  user: {
    id: string;
    walletAddress: string;
    role: string | null;
  };
  refreshSessionId?: string;
}) => {
  const now = Math.floor(Date.now() / 1000);
  const sessionId = randomUUID();
  const accessExp = now + env.AUTH_ACCESS_TOKEN_TTL_SECONDS;

  const accessToken = await signToken(jwt, {
    sub: user.id,
    wal: user.walletAddress,
    role: user.role,
    jti: sessionId,
    type: "access",
    exp: accessExp,
  });

  await redisClient.setex(
    authSessionKey(sessionId),
    env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    JSON.stringify({
      userId: user.id,
      walletAddress: user.walletAddress,
      role: user.role,
      refreshSessionId: refreshSessionId ?? null,
      createdAt: new Date().toISOString(),
    })
  );

  if (refreshSessionId) {
    await redisClient.setex(
      accessRefreshKey(sessionId),
      env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
      refreshSessionId
    );
    await redisClient.sadd(refreshAccessSetKey(refreshSessionId), sessionId);
    await redisClient.expire(
      refreshAccessSetKey(refreshSessionId),
      env.AUTH_REFRESH_TOKEN_TTL_SECONDS
    );
  }

  return {
    accessToken,
    tokenType: "Bearer" as const,
    expiresIn: env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    sessionId,
  };
};

const issueSessionTokens = async ({
  jwt,
  redisClient,
  user,
}: {
  jwt: AuthJwt;
  redisClient: AuthRedis;
  user: {
    id: string;
    walletAddress: string;
    role: string | null;
  };
}) => {
  const now = Math.floor(Date.now() / 1000);
  const refreshTokenId = randomUUID();
  const refreshExp = now + env.AUTH_REFRESH_TOKEN_TTL_SECONDS;

  const refreshToken = await signToken(jwt, {
    sub: user.id,
    wal: user.walletAddress,
    role: user.role,
    jti: refreshTokenId,
    type: "refresh",
    exp: refreshExp,
  });

  await redisClient.setex(
    refreshSessionKey(refreshTokenId),
    env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
    JSON.stringify({
      userId: user.id,
      walletAddress: user.walletAddress,
      role: user.role,
      createdAt: new Date().toISOString(),
    })
  );

  const accessSession = await issueAccessSessionToken({
    jwt,
    redisClient,
    user,
    refreshSessionId: refreshTokenId,
  });

  return {
    accessToken: accessSession.accessToken,
    refreshToken,
    tokenType: accessSession.tokenType,
    expiresIn: accessSession.expiresIn,
    sessionId: accessSession.sessionId,
  };
};

const emitEventSafely = async <K extends AuthEventName>(
  eventBus: AuthEventBus | undefined,
  event: K,
  payload: AuthEventPayload<K>
) => {
  if (!eventBus) {
    return;
  }

  try {
    await eventBus.emit(event, payload);
  } catch (error) {
    log.warn({ event, error }, "Failed to emit auth event");
  }
};

export const authService = {
  generateNonce: async (redisClient: AuthRedis, input: GenerateNonceInput) => {
    const walletAddress = input.walletAddress.trim();
    if (!walletAddress) {
      throw BadRequest("Wallet address is required.");
    }

    const existingNonce = await redisClient.get(walletNonceKey(walletAddress));
    if (existingNonce) {
      await redisClient.del(noncePayloadKey(existingNonce));
      await redisClient.del(walletNonceKey(walletAddress));
    }

    const record = createNonceRecord(walletAddress);

    await redisClient.setex(
      walletNonceKey(walletAddress),
      env.AUTH_NONCE_TTL_SECONDS,
      record.nonce
    );

    await redisClient.setex(
      noncePayloadKey(record.nonce),
      env.AUTH_NONCE_TTL_SECONDS,
      JSON.stringify(record)
    );

    log.info({ walletAddress }, "Auth nonce issued");

    return {
      ...record,
      message: buildSiwsMessage(record),
    };
  },

  verifySignature: async (
    redisClient: AuthRedis,
    dbClient: AuthDb,
    jwt: AuthJwt,
    input: VerifyNonceInput,
    eventBus?: AuthEventBus
  ) => {
    const { walletAddress, nonce, message, signature } = input;

    if (!walletAddress || !nonce || !message || !signature) {
      throw BadRequest("Missing required fields: walletAddress, nonce, message, signature");
    }

    const noncePayload = await redisClient.get(noncePayloadKey(nonce));
    if (!noncePayload) {
      throw BadRequest("Nonce not found or expired. Request a new nonce.");
    }

    const record = parseRecord(noncePayload);
    if (!record) {
      throw BadRequest("Invalid nonce record.");
    }

    if (record.walletAddress !== walletAddress) {
      throw BadRequest("Nonce does not belong to this wallet address.");
    }

    if (new Date() > new Date(record.expiresAt)) {
      await redisClient.del(noncePayloadKey(nonce));
      await redisClient.del(walletNonceKey(walletAddress));
      throw BadRequest("Nonce has expired. Request a new nonce.");
    }

    const expectedMessage = buildSiwsMessage(record);
    if (expectedMessage !== message) {
      throw BadRequest("Signed message does not match server-issued message.");
    }

    const signatureValid = verifyWalletSignature({ walletAddress, message, signature });
    if (!signatureValid) {
      throw BadRequest("Invalid signature for provided wallet address.");
    }

    await redisClient.del(noncePayloadKey(nonce));
    await redisClient.del(walletNonceKey(walletAddress));

    const existingUsers = await dbClient
      .select()
      .from(users)
      .where(and(eq(users.walletAddress, walletAddress), isNull(users.deletedAt)))
      .limit(1);

    const existingUser = existingUsers[0] ?? null;
    if (existingUser?.isBanned) {
      throw Forbidden("This account is banned.");
    }

    let userId = existingUser?.id ?? null;
    let userRole = (existingUser?.role as string | null | undefined) ?? null;
    let effectiveUsername: string | null = null;
    let effectiveFullName: string | null = null;
    let firstSignIn = false;
    let profileComplete = false;

    if (!existingUser) {
      firstSignIn = true;

      const inserted = await dbClient
        .insert(users)
        .values({
          walletAddress,
          lastSeenAt: new Date(),
        })
        .returning({
          id: users.id,
          role: users.role,
        });

      userId = inserted[0]?.id ?? null;
      userRole = (inserted[0]?.role as string | null | undefined) ?? null;
    } else {
      effectiveUsername = existingUser.username ?? null;
      effectiveFullName = existingUser.fullName ?? null;
      profileComplete = Boolean(existingUser.username && existingUser.fullName);

      await dbClient
        .update(users)
        .set({
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));
    }

    if (!userId) {
      throw BadRequest("Unable to create user session.");
    }

    const session = await issueSessionTokens({
      jwt,
      redisClient,
      user: {
        id: userId,
        walletAddress,
        role: userRole,
      },
    });

    const response = {
      verified: true,
      firstSignIn,
      profile: {
        walletAddress,
        username: effectiveUsername,
        displayName: effectiveFullName,
        profileComplete,
      },
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      tokenType: session.tokenType,
      expiresIn: session.expiresIn,
    };

    await emitEventSafely(eventBus, "auth:session:created", {
      userId,
      walletAddress,
      sessionId: session.sessionId,
      firstSignIn,
    });

    log.info({ walletAddress }, "Wallet verified and session issued");

    return response;
  },

  refreshAccessToken: async (
    redisClient: AuthRedis,
    dbClient: AuthDb,
    jwt: AuthJwt,
    input: RefreshInput,
    eventBus?: AuthEventBus
  ) => {
    const refreshToken = input.refreshToken?.trim();
    if (!refreshToken) {
      throw BadRequest("refreshToken is required.");
    }

    let verifiedPayload: Awaited<ReturnType<AuthJwt["verify"]>>;
    try {
      verifiedPayload = await jwt.verify(refreshToken);
    } catch {
      throw BadRequest("Invalid refresh token.");
    }

    const payload = parseTokenPayload(verifiedPayload);
    if (!payload || payload.type !== "refresh") {
      throw BadRequest("Invalid refresh token.");
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      throw BadRequest("Refresh token expired.");
    }

    const refreshSession = await redisClient.get(refreshSessionKey(payload.jti));
    if (!refreshSession) {
      throw BadRequest("Refresh token revoked or expired.");
    }

    const dbUsers = await dbClient
      .select({
        id: users.id,
        walletAddress: users.walletAddress,
        role: users.role,
        isBanned: users.isBanned,
      })
      .from(users)
      .where(and(eq(users.id, payload.sub), eq(users.walletAddress, payload.wal), isNull(users.deletedAt)))
      .limit(1);

    const user = dbUsers[0] ?? null;
    if (!user) {
      throw BadRequest("User not found for refresh token.");
    }

    if (user.isBanned) {
      throw Forbidden("This account is banned.");
    }

    const session = await issueAccessSessionToken({
      jwt,
      redisClient,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        role: (user.role as string | null | undefined) ?? null,
      },
      refreshSessionId: payload.jti,
    });

    await emitEventSafely(eventBus, "auth:session:created", {
      userId: user.id,
      walletAddress: user.walletAddress,
      sessionId: session.sessionId,
      firstSignIn: false,
    });

    return {
      accessToken: session.accessToken,
      tokenType: session.tokenType,
      expiresIn: session.expiresIn,
    };
  },

  resolveSessionFromToken: async ({
    jwt,
    redis,
    db,
    token,
  }: {
    jwt: AuthJwt;
    redis: AuthRedis;
    db: AuthDb;
    token: string;
  }): Promise<AuthenticatedUser | null> => {
    if (!token || token.trim().length === 0) {
      return null;
    }

    let verifiedPayload: Awaited<ReturnType<AuthJwt["verify"]>>;
    try {
      verifiedPayload = await jwt.verify(token.trim());
    } catch {
      return null;
    }

    const payload = parseTokenPayload(verifiedPayload);
    if (!payload || payload.type !== "access") {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }

    const session = await redis.get(authSessionKey(payload.jti));
    if (!session) {
      return null;
    }

    const dbUsers = await db
      .select({
        id: users.id,
        walletAddress: users.walletAddress,
        role: users.role,
        isBanned: users.isBanned,
      })
      .from(users)
      .where(and(eq(users.id, payload.sub), eq(users.walletAddress, payload.wal), isNull(users.deletedAt)))
      .limit(1);

    const user = dbUsers[0] ?? null;
    if (!user) {
      await redis.del(authSessionKey(payload.jti));
      await redis.del(accessRefreshKey(payload.jti));
      return null;
    }

    if (user.isBanned) {
      await redis.del(authSessionKey(payload.jti));
      await redis.del(accessRefreshKey(payload.jti));
      return null;
    }

    return {
      id: user.id,
      walletAddress: user.walletAddress,
      role: (user.role as string | null | undefined) ?? null,
      sessionId: payload.jti,
    };
  },

  signOutSession: async ({
    redisClient,
    sessionId,
    userId,
    eventBus,
  }: {
    redisClient: AuthRedis;
    sessionId: string;
    userId: string;
    eventBus?: AuthEventBus;
  }) => {
    if (!sessionId || sessionId.trim().length === 0) {
      return;
    }

    const linkedRefreshSessionId = await redisClient.get(accessRefreshKey(sessionId));

    await redisClient.del(authSessionKey(sessionId));
    await redisClient.del(accessRefreshKey(sessionId));

    if (linkedRefreshSessionId) {
      const linkedAccessSessions = await redisClient.smembers(
        refreshAccessSetKey(linkedRefreshSessionId)
      );
      const sessionIds = Array.from(new Set([sessionId, ...linkedAccessSessions]));

      for (const linkedSessionId of sessionIds) {
        await redisClient.del(authSessionKey(linkedSessionId));
        await redisClient.del(accessRefreshKey(linkedSessionId));
      }

      await redisClient.del(refreshAccessSetKey(linkedRefreshSessionId));
      await redisClient.del(refreshSessionKey(linkedRefreshSessionId));
    }

    await emitEventSafely(eventBus, "auth:session:terminated", {
      userId,
      sessionId,
    });
  },

  completeProfile: async (
    dbClient: AuthDb,
    input: CompleteProfileInput,
    eventBus?: AuthEventBus
  ) => {
    try {
      const walletAddress = input.walletAddress.trim();
      const username = input.username.trim();
      const fullName = input.fullName.trim();

      if (!walletAddress || !username || !fullName) {
        throw BadRequest("walletAddress, username, and fullName are required.");
      }

      const existingUsers = await dbClient
        .select({
          id: users.id,
          walletAddress: users.walletAddress,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(and(eq(users.walletAddress, walletAddress), isNull(users.deletedAt)))
        .limit(1);

      const existingUser = existingUsers[0] ?? null;
      if (!existingUser) {
        throw BadRequest("User not found for this wallet address.");
      }

      const usernameCollision = await dbClient
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.username, username),
            ne(users.walletAddress, walletAddress),
            isNull(users.deletedAt)
          )
        )
        .limit(1);

      if (usernameCollision.length > 0) {
        throw BadRequest("Username already taken. Please choose another username.");
      }

      await dbClient
        .update(users)
        .set({
          username,
          fullName,
          usernameUpdatedAt: new Date(),
          updatedAt: new Date(),
          lastSeenAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));

      await emitEventSafely(eventBus, "auth:profile:completed", {
        userId: existingUser.id,
        walletAddress,
        username,
        displayName: fullName,
      });

      return {
        profile: {
          walletAddress,
          username,
          displayName: fullName,
          profileComplete: true as const,
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const dbError = error as {
        code?: string;
        message?: string;
        cause?: { code?: string; message?: string };
      };

      const errorCode = dbError.code ?? dbError.cause?.code;
      const errorMessage = dbError.message ?? dbError.cause?.message ?? "";

      if (
        errorCode === "23505" ||
        /duplicate key|users_username_unique|unique constraint/i.test(errorMessage)
      ) {
        throw BadRequest("Username already taken. Please choose another username.");
      }

      if (errorCode === "42703" || /column .*full_name.* does not exist/i.test(errorMessage)) {
        throw BadRequest("Profile schema is outdated. Run database migrations and try again.");
      }

      throw error;
    }
  },
};
