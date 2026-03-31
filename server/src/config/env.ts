const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  REDIS_URL: process.env.REDIS_URL!,
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 8000,
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  AUTH_NONCE_TTL_SECONDS: parsePositiveInt(process.env.AUTH_NONCE_TTL_SECONDS, 300),
  AUTH_ACCESS_TOKEN_TTL_SECONDS: parsePositiveInt(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS, 3600),
  AUTH_REFRESH_TOKEN_TTL_SECONDS: parsePositiveInt(process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS, 604800),
  AUTH_SIWS_DOMAIN: process.env.AUTH_SIWS_DOMAIN || "nyx.local",
  AUTH_SIWS_URI: process.env.AUTH_SIWS_URI || "http://localhost:3000",
  AUTH_SIWS_STATEMENT:
    process.env.AUTH_SIWS_STATEMENT ||
    "Sign this message to authenticate with Nyx. This request will not trigger a blockchain transaction.",
};