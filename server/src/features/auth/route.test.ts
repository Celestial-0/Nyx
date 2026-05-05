import { afterEach, describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";
import { authRoutes } from "@/features/auth/route";
import { authService } from "@/features/auth/service";
import { redis } from "@/platform/redis/client";
import type { AppBindings } from "@/types/global";
import { AppError } from "@/shared/error";

const originalGenerateNonce = authService.generateNonce;
const originalVerifySignature = authService.verifySignature;

const cleanupAbuseKeys = async () => {
  const keys = await redis.keys("abuse:*");

  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

const createTestApp = () => {
  const app = new Hono<AppBindings>();

  app.use("*", async (c, next) => {
    c.set("db", {} as never);
    c.set("redis", redis);
    c.set("jwt", {} as never);
    c.set("eventBus", { emit: async () => {} } as never);
    c.set("authUser", null);
    await next();
  });

  app.route("/", authRoutes);
  app.onError((error, c) => {
    if (error instanceof AppError) {
      return c.json(
        {
          success: false,
          error: error.code,
          message: error.message,
          details: error.details,
        },
        error.statusCode as never
      );
    }

    return c.json(
      {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong",
      },
      500
    );
  });

  return app;
};

afterEach(() => {
  authService.generateNonce = originalGenerateNonce;
  authService.verifySignature = originalVerifySignature;
  mock.restore();
  return cleanupAbuseKeys();
});

describe("authRoutes", () => {
  test("POST /auth/nonce is throttled per client and wallet", async () => {
    authService.generateNonce = async ({ input }) => ({
      walletAddress: input.walletAddress,
      nonce: "nonce",
      message: "message",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const app = createTestApp();
    const walletAddress = "11111111111111111111111111111111";
    const headers = {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.request("/auth/nonce", {
        method: "POST",
        headers,
        body: JSON.stringify({ walletAddress }),
      });

      expect(response.status).toBe(200);
    }

    const throttledResponse = await app.request("/auth/nonce", {
      method: "POST",
      headers,
      body: JSON.stringify({ walletAddress }),
    });
    const throttledPayload = await throttledResponse.json();

    expect(throttledResponse.status).toBe(429);
    expect(throttledPayload).toMatchObject({
      success: false,
      error: "RATE_LIMITED",
      details: {
        scope: "auth.nonce",
      },
    });
  });

  test("POST /auth/verify is throttled per client and wallet", async () => {
    authService.verifySignature = async () => ({
      verified: true,
      firstSignIn: false,
      deviceRegistrationRequired: false,
      profile: {
        walletAddress: "11111111111111111111111111111111",
        username: null,
        displayName: null,
        profileComplete: false,
      },
      activeDevice: {
        deviceId: "11111111-1111-1111-1111-111111111111",
        fingerprint: "abc12345device",
        identityKey: {
          kty: "x25519" as const,
          publicKey: "11111111111111111111111111111111",
        },
        signedPreKey: {
          keyId: "22222222-2222-2222-2222-222222222222",
          kty: "x25519" as const,
          publicKey: "11111111111111111111111111111111",
          signature: "11111111111111111111111111111111",
          issuedAt: new Date().toISOString(),
          expiresAt: null,
        },
        status: "active" as const,
        registeredAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        revokedAt: null,
      },
      prekeyStatus: {
        signedPreKeyRegistered: true,
        oneTimePreKeysRemaining: 10,
        oneTimePreKeysLowWatermark: false,
      },
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tokenType: "Bearer" as const,
      expiresIn: 3600,
    });

    const app = createTestApp();
    const headers = {
      "Content-Type": "application/json",
      "x-real-ip": "198.51.100.25",
    };
    const body = {
      walletAddress: "11111111111111111111111111111111",
      nonce: "nonce-value",
      message: "valid signed message payload",
      signature: "11111111111111111111111111111111",
    };

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await app.request("/auth/verify", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      expect(response.status).toBe(200);
    }

    const throttledResponse = await app.request("/auth/verify", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const throttledPayload = await throttledResponse.json();

    expect(throttledResponse.status).toBe(429);
    expect(throttledPayload).toMatchObject({
      success: false,
      error: "RATE_LIMITED",
      details: {
        scope: "auth.verify",
      },
    });
  });
});
