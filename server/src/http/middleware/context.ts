import type { MiddlewareHandler } from "hono";
import { eventBus } from "@/platform/events";
import { db } from "@/platform/db/client";
import { redis } from "@/platform/redis/client";
import { jwtService } from "@/security/jwt";
import type { AppBindings } from "@/types/global";

export const attachServices: MiddlewareHandler<AppBindings> = async (c, next) => {
  c.set("db", db);
  c.set("redis", redis);
  c.set("jwt", jwtService);
  c.set("eventBus", eventBus);
  c.set("authUser", null);
  c.set("requestErrorCode", null);
  await next();
};
