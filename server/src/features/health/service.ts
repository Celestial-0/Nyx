import type { z } from "zod";
import { observabilityMetrics } from "@/observability";
import { healthDataSchema } from "@/features/health/schema";
import type { db } from "@/platform/db/client";
import type { redis } from "@/platform/redis/client";

type HealthData = z.infer<typeof healthDataSchema>;
type ServiceStatus = HealthData["services"]["db"];
type HealthDb = Pick<typeof db, "execute">;
type HealthRedis = Pick<typeof redis, "ping">;
type RealtimeProbe = {
  isConnected: boolean;
  isSubscribed: boolean;
};

const formatTime = () =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "long",
  }).format(new Date());

const getOverallStatus = (statuses: ServiceStatus[]) =>
  statuses.every((status) => status === "ok")
    ? "ok"
    : statuses.every((status) => status === "error")
      ? "degraded"
      : "partial";

const getUptimeSeconds = () => Math.max(0, Math.floor(process.uptime()));

const getDependencyStatuses = async ({
  dbClient,
  redisClient,
}: {
  dbClient: HealthDb;
  redisClient: HealthRedis;
}) => {
  let dbStatus: ServiceStatus = "ok";
  let redisStatus: ServiceStatus = "ok";

  try {
    await dbClient.execute("SELECT 1");
  } catch {
    dbStatus = "error";
  }

  try {
    await redisClient.ping();
  } catch {
    redisStatus = "error";
  }

  observabilityMetrics.setDependencyUp("db", dbStatus === "ok");
  observabilityMetrics.setDependencyUp("redis", redisStatus === "ok");

  return {
    dbStatus,
    redisStatus,
  };
};

export const healthService = {
  async getHealthSnapshot({
    dbClient,
    redisClient,
    realtimeProbe,
  }: {
    dbClient: HealthDb;
    redisClient: HealthRedis;
    realtimeProbe: RealtimeProbe;
  }): Promise<HealthData> {
    const { dbStatus, redisStatus } = await getDependencyStatuses({
      dbClient,
      redisClient,
    });

    const realtimeStatus: ServiceStatus =
      realtimeProbe.isConnected && realtimeProbe.isSubscribed ? "ok" : "error";

    observabilityMetrics.setDependencyUp("realtime", realtimeStatus === "ok");

    return {
      status: getOverallStatus([dbStatus, redisStatus, realtimeStatus]),
      services: {
        db: dbStatus,
        redis: redisStatus,
        realtime: realtimeStatus,
      },
      time: formatTime(),
      uptimeSeconds: getUptimeSeconds(),
    };
  },
};
