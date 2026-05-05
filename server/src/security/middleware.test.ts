import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createHttpOriginMiddleware, noStoreResponse, securityHeaders } from "@/security";
import { createOriginPolicy } from "@/security/origin";
import type { AppBindings } from "@/types/global";
import { AppError } from "@/shared/error";

const createTestApp = () => {
  const app = new Hono<AppBindings>();
  const originPolicy = createOriginPolicy({
    nodeEnv: "production",
    corsAllowedOriginsRaw: "https://app.nyx.test",
    wsAllowedOriginsRaw: "https://ws.nyx.test",
  });

  app.use("*", async (c, next) => {
    c.set("db", {} as never);
    c.set("redis", {} as never);
    c.set("jwt", {} as never);
    c.set("eventBus", {} as never);
    c.set("authUser", null);
    c.set("requestId", "req-security");
    c.set("requestErrorCode", null);
    await next();
  });
  app.use("*", securityHeaders);
  app.use("*", createHttpOriginMiddleware(originPolicy));
  app.use("/auth/*", noStoreResponse);
  app.get("/health", (c) => c.json({ success: true }));
  app.get("/auth/session", (c) => c.json({ success: true }));
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

    return c.json({ success: false, error: "INTERNAL_SERVER_ERROR" }, 500);
  });

  return app;
};

describe("security middleware", () => {
  test("CORS allows configured origins and echoes credentials headers", async () => {
    const app = createTestApp();
    const response = await app.request("/health", {
      headers: {
        Origin: "https://app.nyx.test",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.nyx.test");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  test("HTTP requests with disallowed origins are rejected", async () => {
    const app = createTestApp();
    const response = await app.request("/health", {
      headers: {
        Origin: "https://evil.example",
      },
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      success: false,
      error: "FORBIDDEN",
      message: "Origin not allowed.",
    });
  });

  test("HTTP requests without an Origin header still work for non-browser callers", async () => {
    const app = createTestApp();
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("auth responses are marked no-store", async () => {
    const app = createTestApp();
    const response = await app.request("/auth/session");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
