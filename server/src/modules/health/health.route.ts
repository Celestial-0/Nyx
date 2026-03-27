import { Elysia } from "elysia";
import type { InfraSingleton } from "@/types/infra-singleton";
import { healthService } from "@/modules/health/health.service";
import { success } from "@/utils/response";

export const healthRoutes = new Elysia<"/health", InfraSingleton>({ prefix: "/health" })
  .get("/", async ({ db, redis }) => {
    const data = await healthService(db, redis);
    return success(data);
  });
