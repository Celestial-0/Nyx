import { afterEach, describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";
import { authService } from "@/features/auth/service";
import { dmRoutes } from "@/features/dm/route";
import type { AppBindings } from "@/types/global";
import { AppError } from "@/shared/error";

const originalResolveSessionFromToken = authService.resolveSessionFromToken;

const createTestApp = () => {
  const app = new Hono<AppBindings>();

  app.use("*", async (c, next) => {
    c.set("db", {} as never);
    c.set("redis", {} as never);
    c.set("jwt", {} as never);
    c.set("eventBus", { emit: async () => {} } as never);
    c.set("authUser", null);
    await next();
  });

  app.route("/", dmRoutes);
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
});

describe("dmRoutes", () => {
  test("POST /dm/start requires authentication", async () => {
    const app = createTestApp();

    const response = await app.request("/dm/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "alice" }),
    });

    expect(response.status).toBe(401);
  });

  test("POST /dm/start validates exactly one lookup field", async () => {
    authService.resolveSessionFromToken = async () =>
      ({
        id: "11111111-1111-1111-1111-111111111111",
        walletAddress: "wallet",
        role: "user",
        sessionId: "session",
        tokenId: "token-id",
      }) as never;

    const app = createTestApp();

    const response = await app.request("/dm/start", {
      method: "POST",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "alice",
        walletAddress: "11111111111111111111111111111111",
      }),
    });

    expect(response.status).toBe(400);
  });
});
