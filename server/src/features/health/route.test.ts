import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { chatRealtimeBridge } from "@/features/chat/realtime";
import { healthRoutes } from "@/features/health/route";
import { observabilityMetrics } from "@/observability";
import type { AppBindings } from "@/types/global";

const originalRealtimeProbe = chatRealtimeBridge.getReadinessState;

const createHealthApp = ({
  dbHealthy = true,
  redisHealthy = true,
}: {
  dbHealthy?: boolean;
  redisHealthy?: boolean;
} = {}) => {
  const app = new Hono<AppBindings>();

  app.use("*", async (c, next) => {
    c.set("db", {
      execute: async () => {
        if (!dbHealthy) {
          throw new Error("db down");
        }
      },
    } as never);
    c.set("redis", {
      ping: async () => {
        if (!redisHealthy) {
          throw new Error("redis down");
        }
        return "PONG";
      },
    } as never);
    c.set("jwt", {} as never);
    c.set("eventBus", {} as never);
    c.set("authUser", null);
    c.set("requestId", "health-test");
    await next();
  });

  app.route("/", healthRoutes);

  return app;
};

afterEach(() => {
  chatRealtimeBridge.getReadinessState = originalRealtimeProbe;
  observabilityMetrics.resetForTests();
});

describe("healthRoutes", () => {
  test("GET /health returns 200 when db, redis, and realtime are ready", async () => {
    const app = createHealthApp();

    chatRealtimeBridge.getReadinessState = () => ({
      isConnected: true,
      isSubscribed: true,
    });

    const response = await app.request("/health");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      data: {
        status: "ok",
        services: {
          db: "ok",
          redis: "ok",
          realtime: "ok",
        },
      },
    });
    expect(typeof payload.data.uptimeSeconds).toBe("number");
  });

  test("GET /health returns 503 when db is not ready", async () => {
    const app = createHealthApp({
      dbHealthy: false,
    });

    chatRealtimeBridge.getReadinessState = () => ({
      isConnected: true,
      isSubscribed: true,
    });

    const response = await app.request("/health");
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.data.services.db).toBe("error");
  });

  test("GET /health returns 503 when redis is not ready", async () => {
    const app = createHealthApp({
      redisHealthy: false,
    });

    chatRealtimeBridge.getReadinessState = () => ({
      isConnected: true,
      isSubscribed: true,
    });

    const response = await app.request("/health");
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.data.services.redis).toBe("error");
  });

  test("GET /health returns 503 when realtime subscriber is not ready", async () => {
    const app = createHealthApp();

    chatRealtimeBridge.getReadinessState = () => ({
      isConnected: true,
      isSubscribed: false,
    });

    const response = await app.request("/health");
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.data.services.realtime).toBe("error");
  });
});
