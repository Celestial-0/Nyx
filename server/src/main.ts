import { websocket } from "hono/bun";
import { app } from "@/app";
import { env } from "@/config/env";
import { closeDB } from "@/platform/db/client";
import { closeRedis } from "@/platform/redis/client";
import { logger } from "@/shared/logger";

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutting down Nyx API");
  await Promise.allSettled([closeDB(), closeRedis()]);
  process.exit(0);
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

logger.info({ port: env.PORT }, "Nyx API (Hono) configured");

export default {
  port: env.PORT,
  fetch: app.fetch,
  websocket,
};
