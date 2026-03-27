export const healthService = async (db: any, redis: any) => {
  let dbStatus = "ok";
  let redisStatus = "ok";

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
      : "degraded";

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