import { z } from "zod";

const parsePositiveInt = (fallback: number) =>
  z.coerce.number().int().positive().catch(fallback);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required."),
  REDIS_URL: z.string().min(1, "REDIS_URL is required."),
  PORT: parsePositiveInt(8000),
  NODE_ENV: z.string().default("development"),
  LOG_LEVEL: z.string().default("info"),
  AUTH_NONCE_TTL_SECONDS: parsePositiveInt(300),
  AUTH_ACCESS_TOKEN_TTL_SECONDS: parsePositiveInt(3600),
  AUTH_REFRESH_TOKEN_TTL_SECONDS: parsePositiveInt(604800),
  MESSAGE_RETENTION_DAYS: parsePositiveInt(30),
  REALTIME_NODE_ID: z.string().min(1).optional(),
  REALTIME_ACTIVE_CONNECTION_TTL_SECONDS: parsePositiveInt(90),
  REALTIME_MESSAGE_DEDUPE_TTL_SECONDS: parsePositiveInt(86400),
  REALTIME_RATE_LIMIT_CAPACITY: parsePositiveInt(20),
  REALTIME_RATE_LIMIT_REFILL_PER_SECOND: parsePositiveInt(5),
  SOLANA_RPC_URL: z.string().url().default("https://api.mainnet-beta.solana.com"),
  SOLANA_COMMITMENT: z.enum(["processed", "confirmed", "finalized"]).default("confirmed"),
  PAYMENT_TREASURY_WALLET: z.string().min(1).default("11111111111111111111111111111111"),
  PAYMENT_CREDITS_PER_SOL: parsePositiveInt(1000),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  WS_ALLOWED_ORIGINS: z.string().optional(),
  AUTH_JWT_ISSUER: z.string().min(1).default("nyx-server"),
  AUTH_JWT_AUDIENCE: z.string().min(1).default("nyx-clients"),
  AUTH_TOKEN_VERSION: parsePositiveInt(2),
  AUTH_SIWS_DOMAIN: z.string().default("nyx.local"),
  AUTH_SIWS_URI: z.string().default("http://localhost:3000"),
  AUTH_SIWS_STATEMENT: z
    .string()
    .default(
      "Sign this message to authenticate with Nyx. This request will not trigger a blockchain transaction."
    ),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid environment configuration: ${parsedEnv.error.message}`);
}

export const env = parsedEnv.data;
