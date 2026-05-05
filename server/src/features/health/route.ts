import { OpenAPIHono } from "@hono/zod-openapi";
import { chatRealtimeBridge } from "@/features/chat/realtime";
import { getHealthRoute } from "@/features/health/openapi";
import { healthService } from "@/features/health/service";
import type { AppBindings } from "@/types/global";
import { success } from "@/http/response";

export const healthRoutes = new OpenAPIHono<AppBindings>();

healthRoutes.openapi(getHealthRoute, async (c) => {
  const data = await healthService.getHealthSnapshot({
    dbClient: c.get("db"),
    redisClient: c.get("redis"),
    realtimeProbe: chatRealtimeBridge.getReadinessState(),
  });

  const status = data.status === "ok" ? 200 : 503;
  return c.json(success(data), status as 200 | 503);
});
