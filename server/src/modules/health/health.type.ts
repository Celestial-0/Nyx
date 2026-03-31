import { healthDataSchema } from "@/modules/health/health.schema";
import type { redis } from "@/redis/client";
import type { db } from "@/db/client";

export type HealthDb = Pick<typeof db, "execute">;
export type HealthRedis = Pick<typeof redis, "ping">;
export type ServiceStatus = HealthData["services"]["db"];
export type HealthData = typeof healthDataSchema.static;
