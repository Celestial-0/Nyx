import Redis from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";

const log = logger.child({ module: "redis" });

export const redis = new Redis(env.REDIS_URL);

redis.on("ready", () => {
  log.info("Redis ready");
});

redis.on("error", (err: Error) => {
  log.error({ err }, "Redis error");
});

redis.on("connect", () => {
  log.debug("Redis connecting...");
});

redis.on("close", () => {
  log.debug("Redis connection closed");
});

redis.on("reconnecting", () => {
  log.debug("Redis reconnecting...");
});

export const closeRedis = async () => {
  log.info("Closing Redis connection");
  await redis.quit();
};
