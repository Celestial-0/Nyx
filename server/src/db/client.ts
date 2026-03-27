import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/config/env";
import * as schema from "@/db/schema";
import { logger } from "@/utils/logger";

const log = logger.child({ module: "db" });

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on("connect", () => {
  log.info("Postgres connected");
});

pool.on("error", (err) => {
  log.error({ err }, "Postgres pool error");
});

export const db = drizzle(pool, { schema });

export const closeDB = async () => {
  log.info("Closing DB connection");
  await pool.end();
};