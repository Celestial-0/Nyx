import { Elysia } from "elysia";
import { healthMeta, healthService } from "@/modules/health/health.service";
import { success } from "@/utils/response";
import { NyxContext } from "@/app";

export const healthHandler = (new Elysia({
  name: "health.handler",
}) as NyxContext)
.get("/health", async ({ db, redis }) => {
  const data = await healthService(db, redis);
  return success(data);
}, healthMeta);