import { Elysia } from "elysia";
import { redis, closeRedis } from "@/redis/client";

export const redisPlugin = new Elysia({ name: "redis" })
  .decorate("redis", redis)
  .onStop(async () => {
    await closeRedis();
  });