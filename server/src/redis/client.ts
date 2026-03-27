import Redis from "ioredis";
import { logger } from "@/utils/logger";
import { env } from "@/config/env";

const log = logger.child({ module: "redis" });

export const redis = new Redis(env.REDIS_URL);

//  Only meaningful success
redis.on("ready", () => {
  log.info("Redis ready");
});

//  Always log errors
redis.on("error", (err) => {
  log.error({ err }, "Redis error");
});

// Debug-level noise (only in dev)
redis.on("connect", () => {
  log.debug("Redis connecting...");
});

redis.on("close", () => {
  log.debug("Redis connection closed");
});

redis.on("reconnecting", () => {
  log.debug("Redis reconnecting...");
});

/**
 * Graceful shutdown
 */
export const closeRedis = async () => {
  log.info("Closing Redis connection");
  await redis.quit();
};