import { afterEach, describe, expect, mock, test } from "bun:test";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { authService } from "@/features/auth/service";
import { creditLogs, userCredits, users } from "@/platform/db/schema";
import { roomRoutes } from "@/features/rooms/route";
import { redis } from "@/platform/redis/client";
import { withTestTransaction } from "@/test-utils/integration";
import type { AppBindings } from "@/types/global";
import { AppError } from "@/shared/error";

const originalResolveSessionFromToken = authService.resolveSessionFromToken;
const cleanupAbuseKeys = async () => {
  const keys = await redis.keys("abuse:*");

  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

const createTestApp = (dbOverride: unknown = {}) => {
  const app = new Hono<AppBindings>();

  app.use("*", async (c, next) => {
    c.set("db", dbOverride as never);
    c.set("redis", redis);
    c.set("jwt", {} as never);
    c.set("eventBus", { emit: async () => {} } as never);
    c.set("authUser", null);
    await next();
  });

  app.route("/", roomRoutes);
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
  mock.restore();
  return cleanupAbuseKeys();
});

describe("roomRoutes", () => {
  test("POST /rooms requires authentication", async () => {
    const app = createTestApp();

    const response = await app.request("/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "group" }),
    });

    expect(response.status).toBe(401);
  });

  test("POST /rooms rejects direct room creation in this phase", async () => {
    authService.resolveSessionFromToken = async () =>
      ({
        id: "11111111-1111-1111-1111-111111111111",
        walletAddress: "wallet",
        role: "user",
        sessionId: "session",
        tokenId: "token-id",
        activeDeviceId: "33333333-3333-3333-3333-333333333333",
      }) as never;

    const app = createTestApp();

    const response = await app.request("/rooms", {
      method: "POST",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "direct" }),
    });

    expect(response.status).toBe(400);
  });

  test("POST /rooms returns 429 after the configured burst and does not debit extra credits", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    authService.resolveSessionFromToken = async () =>
      ({
        id: userId,
        walletAddress: "wallet",
        role: "user",
        sessionId: "session",
        tokenId: "token-id",
        activeDeviceId: "33333333-3333-3333-3333-333333333333",
      }) as never;

    await withTestTransaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        walletAddress: "wallet",
      });

      const app = createTestApp(tx);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await app.request("/rooms", {
          method: "POST",
          headers: {
            Authorization: "Bearer token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type: "group" }),
        });

        expect(response.status).toBe(200);
      }

      const throttledResponse = await app.request("/rooms", {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "group" }),
      });
      const throttledPayload = await throttledResponse.json();
      const balances = await tx
        .select({
          balance: userCredits.balance,
        })
        .from(userCredits)
        .where(eq(userCredits.userId, userId))
        .limit(1);
      const logs = await tx
        .select({
          change: creditLogs.change,
          reason: creditLogs.reason,
        })
        .from(creditLogs)
        .where(eq(creditLogs.userId, userId))
        .orderBy(asc(creditLogs.createdAt));

      expect(throttledResponse.status).toBe(429);
      expect(throttledPayload).toMatchObject({
        success: false,
        error: "RATE_LIMITED",
        details: {
          scope: "rooms.create",
        },
      });
      expect(balances[0]?.balance).toBe(0);
      expect(logs).toEqual([
        { change: 150, reason: "initial_grant" },
        { change: -50, reason: "room_creation" },
        { change: -50, reason: "room_creation" },
        { change: -50, reason: "room_creation" },
      ]);
    });
  });
});
