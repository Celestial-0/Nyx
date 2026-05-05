import { randomBytes, randomUUID } from "node:crypto";
import { TextEncoder } from "node:util";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { and, eq, isNull, ne } from "drizzle-orm";
import { env } from "@/config/env";
import { users } from "@/platform/db/schema/user/users";
import { authEventTopics } from "@/features/auth/events/topics";
import { e2eeService } from "@/features/e2ee/service";
import { ensureUserCreditAccount } from "@/features/payments/ledger";
import type {
  AccessSessionRecord,
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
  RefreshSessionRecord,
  RefreshInput,
  VerifyNonceInput,
} from "@/features/auth/types";
import { AppError, BadRequest, Forbidden, Unauthorized } from "@/shared/error";
import { logger } from "@/shared/logger";


const decodeBase58 = (value: string): Uint8Array => bs58.decode(value);


const log = logger.child({ module: "auth.service" });

const walletNonceKey = (walletAddress: string) => `auth:nonce:wallet:${walletAddress}`;
const noncePayloadKey = (nonce: string) => `auth:nonce:payload:${nonce}`;
const authSessionKey = (tokenId: string) => `auth:session:${tokenId}`;
const refreshSessionKey = (refreshSessionId: string) => `auth:refresh:${refreshSessionId}`;
const rootSessionRefreshKey = (sessionId: string) => `auth:root:refresh:${sessionId}`;
const rootSessionAccessSetKey = (sessionId: string) => `auth:root:access:${sessionId}`;
const refreshReplayKey = (refreshTokenId: string) => `auth:refresh:replay:${refreshTokenId}`;

const textEncoder = new TextEncoder();

const buildSiwsMessage = ({
  walletAddress,
  nonce,
  issuedAt,
  expiresAt,
}: NonceRecord) =>
  [
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

const parseAccessSessionRecord = (raw: string): AccessSessionRecord | null => {
  try {
    const value = JSON.parse(raw) as Partial<AccessSessionRecord>;

    if (
      typeof value.userId !== "string" ||
      typeof value.walletAddress !== "string" ||
      (value.role !== null && typeof value.role !== "string" && value.role !== undefined) ||
      typeof value.sessionId !== "string" ||
      typeof value.refreshTokenId !== "string" ||
      typeof value.deviceId !== "string" ||
      typeof value.tokenVersion !== "number" ||
      typeof value.createdAt !== "string"
    ) {
      return null;
    }

    return {
      userId: value.userId,
      walletAddress: value.walletAddress,
      role: value.role ?? null,
      sessionId: value.sessionId,
      refreshTokenId: value.refreshTokenId,
      deviceId: value.deviceId,
      tokenVersion: value.tokenVersion,
      createdAt: value.createdAt,
    };
  } catch {
    return null;
  }
};

const parseRefreshSessionRecord = (raw: string): RefreshSessionRecord | null => {
  try {
    const value = JSON.parse(raw) as Partial<RefreshSessionRecord>;

    if (
      typeof value.userId !== "string" ||
      typeof value.walletAddress !== "string" ||
      (value.role !== null && typeof value.role !== "string" && value.role !== undefined) ||
      typeof value.sessionId !== "string" ||
      typeof value.deviceId !== "string" ||
      typeof value.tokenVersion !== "number" ||
      typeof value.createdAt !== "string"
    ) {
      return null;
    }

    return {
      userId: value.userId,
      walletAddress: value.walletAddress,
      role: value.role ?? null,
      sessionId: value.sessionId,
      deviceId: value.deviceId,
      tokenVersion: value.tokenVersion,
      createdAt: value.createdAt,
    };
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
    typeof payload.iss !== "string" ||
    typeof payload.aud !== "string" ||
    (payload.role !== null && typeof payload.role !== "string" && payload.role !== undefined) ||
    typeof payload.ver !== "number" ||
    typeof payload.jti !== "string" ||
    typeof payload.sessionId !== "string" ||
    typeof payload.did !== "string" ||
    (payload.type !== "access" && payload.type !== "refresh") ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }

  return {
    sub: payload.sub,
    wal: payload.wal,
    role: payload.role ?? null,
    iss: payload.iss,
    aud: payload.aud,
    ver: payload.ver,
    jti: payload.jti,
    sessionId: payload.sessionId,
    did: payload.did,
    type: payload.type,
    exp: payload.exp,
  };
};

const isExpectedTokenPayload = (payload: AuthSessionTokenPayload) =>
  payload.iss === env.AUTH_JWT_ISSUER &&
  payload.aud === env.AUTH_JWT_AUDIENCE &&
  payload.ver === env.AUTH_TOKEN_VERSION;

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
    const publicKey = decodeBase58(walletAddress);
    const signatureBytes = decodeBase58(signature);

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

const revokeRootSession = async ({
  redisClient,
  rootSessionId,
}: {
  redisClient: AuthRedis;
  rootSessionId: string;
}) => {
  const accessTokenIds = await redisClient.smembers(rootSessionAccessSetKey(rootSessionId));

  if (accessTokenIds.length > 0) {
    await redisClient.del(...accessTokenIds.map((tokenId) => authSessionKey(tokenId)));
  }

  const currentRefreshTokenId = await redisClient.get(rootSessionRefreshKey(rootSessionId));

  await redisClient.del(rootSessionAccessSetKey(rootSessionId));
  await redisClient.del(rootSessionRefreshKey(rootSessionId));

  if (currentRefreshTokenId) {
    await redisClient.del(refreshSessionKey(currentRefreshTokenId));
  }
};

const issueAccessSessionToken = async ({
  jwt,
  redisClient,
  user,
  rootSessionId,
  refreshTokenId,
}: {
  jwt: AuthJwt;
  redisClient: AuthRedis;
  user: {
    id: string;
    walletAddress: string;
    role: string | null;
    deviceId: string;
  };
  rootSessionId: string;
  refreshTokenId: string;
}) => {
  const now = Math.floor(Date.now() / 1000);
  const accessTokenId = randomUUID();
  const accessExp = now + env.AUTH_ACCESS_TOKEN_TTL_SECONDS;

  const accessToken = await signToken(jwt, {
    sub: user.id,
    wal: user.walletAddress,
    iss: env.AUTH_JWT_ISSUER,
    aud: env.AUTH_JWT_AUDIENCE,
    role: user.role,
    ver: env.AUTH_TOKEN_VERSION,
    jti: accessTokenId,
    sessionId: rootSessionId,
    did: user.deviceId,
    type: "access",
    exp: accessExp,
  });

  await redisClient.setex(
    authSessionKey(accessTokenId),
    env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    JSON.stringify({
      userId: user.id,
      walletAddress: user.walletAddress,
      role: user.role,
      sessionId: rootSessionId,
      refreshTokenId,
      deviceId: user.deviceId,
      tokenVersion: env.AUTH_TOKEN_VERSION,
      createdAt: new Date().toISOString(),
    })
  );

  await redisClient.sadd(rootSessionAccessSetKey(rootSessionId), accessTokenId);
  await redisClient.expire(rootSessionAccessSetKey(rootSessionId), env.AUTH_REFRESH_TOKEN_TTL_SECONDS);

  return {
    accessToken,
    tokenType: "Bearer" as const,
    expiresIn: env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    tokenId: accessTokenId,
    sessionId: rootSessionId,
  };
};

const issueSessionTokens = async ({
  jwt,
  redisClient,
  user,
  rootSessionId = randomUUID(),
}: {
  jwt: AuthJwt;
  redisClient: AuthRedis;
  user: {
    id: string;
    walletAddress: string;
    role: string | null;
    deviceId: string;
  };
  rootSessionId?: string;
}) => {
  const now = Math.floor(Date.now() / 1000);
  const refreshTokenId = randomUUID();
  const refreshExp = now + env.AUTH_REFRESH_TOKEN_TTL_SECONDS;

  const refreshToken = await signToken(jwt, {
    sub: user.id,
    wal: user.walletAddress,
    iss: env.AUTH_JWT_ISSUER,
    aud: env.AUTH_JWT_AUDIENCE,
    role: user.role,
    ver: env.AUTH_TOKEN_VERSION,
    jti: refreshTokenId,
    sessionId: rootSessionId,
    did: user.deviceId,
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
      sessionId: rootSessionId,
      deviceId: user.deviceId,
      tokenVersion: env.AUTH_TOKEN_VERSION,
      createdAt: new Date().toISOString(),
    })
  );

  await redisClient.setex(
    rootSessionRefreshKey(rootSessionId),
    env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
    refreshTokenId
  );

  const accessSession = await issueAccessSessionToken({
    jwt,
    redisClient,
    user,
    rootSessionId,
    refreshTokenId,
  });

  return {
    accessToken: accessSession.accessToken,
    refreshToken,
    tokenType: accessSession.tokenType,
    expiresIn: accessSession.expiresIn,
    sessionId: rootSessionId,
    tokenId: accessSession.tokenId,
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
  generateNonce: async ({
    redis,
    input,
  }: {
    redis: AuthRedis;
    input: GenerateNonceInput;
  }) => {
    const walletAddress = input.walletAddress.trim();

    if (!walletAddress) {
      throw BadRequest("Wallet address is required.");
    }

    const existingNonce = await redis.get(walletNonceKey(walletAddress));

    if (existingNonce) {
      await redis.del(noncePayloadKey(existingNonce));
      await redis.del(walletNonceKey(walletAddress));
    }

    const record = createNonceRecord(walletAddress);

    await redis.setex(
      walletNonceKey(walletAddress),
      env.AUTH_NONCE_TTL_SECONDS,
      record.nonce
    );

    await redis.setex(
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

  verifySignature: async ({
    redis,
    db,
    jwt,
    input,
    eventBus,
  }: {
    redis: AuthRedis;
    db: AuthDb;
    jwt: AuthJwt;
    input: VerifyNonceInput;
    eventBus?: AuthEventBus;
  }) => {
    const { walletAddress, nonce, message, signature, device } = input;

    if (!walletAddress || !nonce || !message || !signature) {
      throw BadRequest("Missing required fields: walletAddress, nonce, message, signature");
    }

    const noncePayload = await redis.get(noncePayloadKey(nonce));

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
      await redis.del(noncePayloadKey(nonce));
      await redis.del(walletNonceKey(walletAddress));
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

    await redis.del(noncePayloadKey(nonce));
    await redis.del(walletNonceKey(walletAddress));

    const existingUsers = await db
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

      const inserted = await db
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

      await db
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

    await ensureUserCreditAccount({
      db,
      userId,
    });

    const activeDeviceContext = device
      ? await e2eeService.registerDevice({
          db,
          userId,
          walletAddress,
          device,
        })
      : null;

    if (!activeDeviceContext) {
      log.info({ walletAddress, userId }, "Wallet verified but device registration is required");

      return {
        verified: true,
        firstSignIn,
        deviceRegistrationRequired: true,
        profile: {
          walletAddress,
          username: effectiveUsername,
          displayName: effectiveFullName,
          profileComplete,
        },
        activeDevice: null,
        prekeyStatus: null,
        accessToken: null,
        refreshToken: null,
        tokenType: null,
        expiresIn: null,
      };
    }

    const session = await issueSessionTokens({
      jwt,
      redisClient: redis,
      user: {
        id: userId,
        walletAddress,
        role: userRole,
        deviceId: activeDeviceContext.activeDevice.deviceId,
      },
    });

    await emitEventSafely(eventBus, authEventTopics.sessionCreated, {
      userId,
      walletAddress,
      sessionId: session.sessionId,
      firstSignIn,
    });

    log.info({ walletAddress }, "Wallet verified and session issued");

    return {
      verified: true,
      firstSignIn,
      deviceRegistrationRequired: false,
      profile: {
        walletAddress,
        username: effectiveUsername,
        displayName: effectiveFullName,
        profileComplete,
      },
      activeDevice: activeDeviceContext.activeDevice,
      prekeyStatus: activeDeviceContext.prekeyStatus,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      tokenType: session.tokenType,
      expiresIn: session.expiresIn,
    };
  },

  refreshAccessToken: async ({
    redis,
    db,
    jwt,
    input,
    eventBus,
  }: {
    redis: AuthRedis;
    db: AuthDb;
    jwt: AuthJwt;
    input: RefreshInput;
    eventBus?: AuthEventBus;
  }) => {
    const refreshToken = input.refreshToken.trim();

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

    if (!payload || payload.type !== "refresh" || !isExpectedTokenPayload(payload)) {
      throw BadRequest("Invalid refresh token.");
    }

    const now = Math.floor(Date.now() / 1000);

    if (payload.exp <= now) {
      throw BadRequest("Refresh token expired.");
    }

    const refreshSessionValue = await redis.get(refreshSessionKey(payload.jti));

    if (!refreshSessionValue) {
      const replayRootSessionId = await redis.get(refreshReplayKey(payload.jti));

      if (replayRootSessionId) {
        await revokeRootSession({
          redisClient: redis,
          rootSessionId: replayRootSessionId,
        });

        throw Unauthorized("Refresh token reuse detected. Please sign in again.");
      }

      throw BadRequest("Refresh token revoked or expired.");
    }

    const refreshSession = parseRefreshSessionRecord(refreshSessionValue);

    if (
      !refreshSession ||
      refreshSession.userId !== payload.sub ||
      refreshSession.walletAddress !== payload.wal ||
      refreshSession.sessionId !== payload.sessionId ||
      refreshSession.deviceId !== payload.did ||
      refreshSession.tokenVersion !== payload.ver
    ) {
      await revokeRootSession({
        redisClient: redis,
        rootSessionId: payload.sessionId,
      });
      throw Unauthorized("Invalid refresh token.");
    }

    const currentRefreshTokenId = await redis.get(rootSessionRefreshKey(payload.sessionId));

    if (!currentRefreshTokenId || currentRefreshTokenId !== payload.jti) {
      await revokeRootSession({
        redisClient: redis,
        rootSessionId: payload.sessionId,
      });
      await redis.setex(
        refreshReplayKey(payload.jti),
        Math.max(1, payload.exp - now),
        payload.sessionId
      );
      throw Unauthorized("Refresh token reuse detected. Please sign in again.");
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
      await revokeRootSession({
        redisClient: redis,
        rootSessionId: payload.sessionId,
      });
      throw Unauthorized("Refresh token is no longer valid.");
    }

    if (user.isBanned) {
      await revokeRootSession({
        redisClient: redis,
        rootSessionId: payload.sessionId,
      });
      throw Forbidden("This account is banned.");
    }

    const activeDeviceContext = input.device
      ? await e2eeService.registerDevice({
          db,
          userId: user.id,
          walletAddress: user.walletAddress,
          device: input.device,
        })
      : await e2eeService.getActiveDeviceForSession({
          db,
          userId: user.id,
          deviceId: payload.did,
        });

    if (!activeDeviceContext) {
      await revokeRootSession({
        redisClient: redis,
        rootSessionId: payload.sessionId,
      });
      throw Unauthorized("The active device is no longer valid for this session.");
    }

    await redis.del(refreshSessionKey(payload.jti));
    await redis.setex(
      refreshReplayKey(payload.jti),
      Math.max(1, payload.exp - now),
      payload.sessionId
    );

    const session = await issueSessionTokens({
      jwt,
      redisClient: redis,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        role: (user.role as string | null | undefined) ?? null,
        deviceId: activeDeviceContext.activeDevice.deviceId,
      },
      rootSessionId: payload.sessionId,
    });

    await emitEventSafely(eventBus, authEventTopics.sessionCreated, {
      userId: user.id,
      walletAddress: user.walletAddress,
      sessionId: session.sessionId,
      firstSignIn: false,
    });

    return {
      activeDevice: activeDeviceContext.activeDevice,
      prekeyStatus: activeDeviceContext.prekeyStatus,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
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

    if (!payload || payload.type !== "access" || !isExpectedTokenPayload(payload)) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    if (payload.exp <= now) {
      return null;
    }

    const sessionValue = await redis.get(authSessionKey(payload.jti));

    if (!sessionValue) {
      return null;
    }

    const session = parseAccessSessionRecord(sessionValue);

    if (
      !session ||
      session.userId !== payload.sub ||
      session.walletAddress !== payload.wal ||
      session.sessionId !== payload.sessionId ||
      session.deviceId !== payload.did ||
      session.refreshTokenId.length === 0 ||
      session.tokenVersion !== payload.ver
    ) {
      await revokeRootSession({
        redisClient: redis,
        rootSessionId: payload.sessionId,
      });
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
      await revokeRootSession({
        redisClient: redis,
        rootSessionId: payload.sessionId,
      });
      return null;
    }

    if (user.isBanned) {
      await revokeRootSession({
        redisClient: redis,
        rootSessionId: payload.sessionId,
      });
      return null;
    }

    const activeDeviceContext = await e2eeService.getActiveDeviceForSession({
      db,
      userId: user.id,
      deviceId: payload.did,
    });

    if (!activeDeviceContext) {
      await revokeRootSession({
        redisClient: redis,
        rootSessionId: payload.sessionId,
      });
      return null;
    }

    return {
      id: user.id,
      walletAddress: user.walletAddress,
      role: (user.role as string | null | undefined) ?? null,
      sessionId: payload.sessionId,
      tokenId: payload.jti,
      activeDeviceId: activeDeviceContext.activeDevice.deviceId,
      activeDevice: activeDeviceContext.activeDevice,
      prekeyStatus: activeDeviceContext.prekeyStatus,
    };
  },

  signOutSession: async ({
    redisClient,
    db,
    sessionId,
    userId,
    deviceId,
    revokeDevice,
    eventBus,
  }: {
    redisClient: AuthRedis;
    db: AuthDb;
    sessionId: string;
    userId: string;
    deviceId: string;
    revokeDevice?: boolean;
    eventBus?: AuthEventBus;
  }) => {
    if (!sessionId || sessionId.trim().length === 0) {
      return null;
    }

    await revokeRootSession({
      redisClient,
      rootSessionId: sessionId,
    });

    const revokedDeviceId =
      revokeDevice === true
        ? ((await e2eeService.revokeDevice({
            db,
            userId,
            deviceId,
          }))
            ? deviceId
            : null)
        : null;

    await emitEventSafely(eventBus, authEventTopics.sessionTerminated, {
      userId,
      sessionId,
    });

    return revokedDeviceId;
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

      await emitEventSafely(eventBus, authEventTopics.profileCompleted, {
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
