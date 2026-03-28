import { HealthData, ServiceStatus, HealthDb, HealthRedis } from "@/modules/health/health.type";

export const healthService = async (
    db: HealthDb,
    redis: HealthRedis
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