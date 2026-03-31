import { HealthData, ServiceStatus } from "@/modules/health/health.type";
import { healthSuccessResponseSchema } from "@/modules/health/health.schema";

export const healthService = async (
    db: any,
    redis: any
): Promise<HealthData> => {

    let dbStatus: ServiceStatus = "ok";
    let redisStatus: ServiceStatus = "ok";

    // DB check
    try {
        await db.execute("SELECT 1");
    } catch {
        dbStatus = "error";
    }

    // Redis check
    try {
        await redis.ping();
    } catch {
        redisStatus = "error";
    }

    const overall =
        dbStatus === "ok" && redisStatus === "ok"
            ? "ok"
            : dbStatus === "error" && redisStatus === "error"
                ? "degraded"
                : "partial";

    const time = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "long",
    }).format(new Date());

    return {
        status: overall,
        services: {
            db: dbStatus,
            redis: redisStatus,
        },
        time,
    };
};

export const healthMeta ={
  detail: {
    tags: ["Health"],
    summary: "Health check",
    description: "Checks API dependencies like Postgres and Redis.",
  },
  response: {
    200: healthSuccessResponseSchema,
  },
};
