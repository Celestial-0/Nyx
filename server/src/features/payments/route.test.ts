import { afterEach, describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";
import { randomBytes } from "node:crypto";
import { authService } from "@/features/auth/service";
import { paymentsService } from "@/features/payments/service";
import { paymentRoutes } from "@/features/payments/route";
import { redis } from "@/platform/redis/client";
import type { AppBindings } from "@/types/global";
import { AppError } from "@/shared/error";
import bs58 from "bs58";

const encodeBase58 = (value: Uint8Array): string => bs58.encode(value);


const originalResolveSessionFromToken = authService.resolveSessionFromToken;
const originalGetCreditsBalance = paymentsService.getCreditsBalance;
const originalVerifyRecharge = paymentsService.verifyRecharge;
const createTransactionHash = () => encodeBase58(randomBytes(64));

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

  app.route("/", paymentRoutes);
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
  authService.resolveSessionFromToken = originalResolveSessionFromToken;
  paymentsService.getCreditsBalance = originalGetCreditsBalance;
  paymentsService.verifyRecharge = originalVerifyRecharge;
  mock.restore();
  return cleanupAbuseKeys();
});

describe("paymentRoutes", () => {
  test("GET /payments/credits requires authentication", async () => {
    const app = createTestApp();

    const response = await app.request("/payments/credits");

    expect(response.status).toBe(401);
  });

  test("GET /payments/credits returns the expanded credits payload", async () => {
    authService.resolveSessionFromToken = async () =>
      ({
        id: "11111111-1111-1111-1111-111111111111",
        walletAddress: "wallet",
        role: "user",
        sessionId: "session",
        tokenId: "token-id",
      }) as never;

    paymentsService.getCreditsBalance = async () => ({
      balance: 150,
      pricing: {
        creditsPerSol: 1000,
        defaultInitialCredits: 150,
        messageSendCredits: 2,
        groupRoomCreateCredits: 50,
      },
      treasury: {
        walletAddress: "11111111111111111111111111111111",
      },
      network: {
        chain: "solana" as const,
        rpcUrl: "http://127.0.0.1:8899",
        commitment: "confirmed",
      },
      recentRecharges: [],
      recentActivity: [],
    });

    const app = createTestApp();
    const response = await app.request("/payments/credits", {
      headers: {
        Authorization: "Bearer token",
      },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      data: {
        balance: 150,
        pricing: {
          creditsPerSol: 1000,
        },
        treasury: {
          walletAddress: "11111111111111111111111111111111",
        },
        network: {
          chain: "solana",
        },
      },
    });
  });

  test("POST /payments/recharge/verify validates request body", async () => {
    authService.resolveSessionFromToken = async () =>
      ({
        id: "11111111-1111-1111-1111-111111111111",
        walletAddress: "wallet",
        role: "user",
        sessionId: "session",
        tokenId: "token-id",
      }) as never;

    const app = createTestApp();
    const response = await app.request("/payments/recharge/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  test("POST /payments/recharge/verify rate limits before recharge verification runs", async () => {
    authService.resolveSessionFromToken = async () =>
      ({
        id: "11111111-1111-1111-1111-111111111111",
        walletAddress: "wallet",
        role: "user",
        sessionId: "session",
        tokenId: "token-id",
      }) as never;

    let calls = 0;
    paymentsService.verifyRecharge = async () => {
      calls += 1;
      return {
        transactionHash: "tx",
        amountSol: "1",
        creditsGranted: 1000,
        balance: 1150,
        status: "confirmed",
      };
    };

    const app = createTestApp();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.request("/payments/recharge/verify", {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transactionHash: createTransactionHash() }),
      });

      expect(response.status).toBe(200);
    }

    const response = await app.request("/payments/recharge/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactionHash: createTransactionHash() }),
    });
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(calls).toBe(5);
    expect(payload).toMatchObject({
      success: false,
      error: "RATE_LIMITED",
      details: {
        scope: "payments.recharge.verify",
      },
    });
  });
});
