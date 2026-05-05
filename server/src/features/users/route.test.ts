import { afterEach, describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";
import { userRoutes } from "@/features/users/route";
import { usersService } from "@/features/users/service";
import { redis } from "@/platform/redis/client";
import type { AppBindings } from "@/types/global";
import { AppError } from "@/shared/error";

const originalSearch = usersService.search;
const originalGetByUsername = usersService.getByUsername;
const originalGetByWallet = usersService.getByWallet;

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

  app.route("/", userRoutes);
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
  usersService.search = originalSearch;
  usersService.getByUsername = originalGetByUsername;
  usersService.getByWallet = originalGetByWallet;
  mock.restore();
  return cleanupAbuseKeys();
});

describe("userRoutes", () => {
  test("GET /users/search and /users/lookup share the same discovery bucket", async () => {
    usersService.search = async () => [];
    usersService.getByUsername = async () => ({
      id: "11111111-1111-1111-1111-111111111111",
      walletAddress: "11111111111111111111111111111111",
      username: "search-user",
      displayName: null,
      role: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const app = createTestApp();
    const headers = {
      "x-real-ip": "198.51.100.77",
    };

    for (let attempt = 0; attempt < 15; attempt += 1) {
      const searchResponse = await app.request(`/users/search?q=user-${attempt}`, {
        headers,
      });
      expect(searchResponse.status).toBe(200);
    }

    for (let attempt = 0; attempt < 15; attempt += 1) {
      const lookupResponse = await app.request(
        `/users/lookup?by=username&value=user-${attempt}`,
        {
          headers,
        }
      );
      expect(lookupResponse.status).toBe(200);
    }

    const throttledResponse = await app.request("/users/search?q=overflow", {
      headers,
    });
    const throttledPayload = await throttledResponse.json();

    expect(throttledResponse.status).toBe(429);
    expect(throttledPayload).toMatchObject({
      success: false,
      error: "RATE_LIMITED",
      details: {
        scope: "users.discovery",
      },
    });
  });
});
