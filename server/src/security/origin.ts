import { env } from "@/config/env";

const devDefaultOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
];

const normalizeOrigin = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
};

const parseOriginAllowlist = (raw: string | undefined, fallback: string[] = []) => {
  const source = raw?.trim().length ? raw.split(",") : fallback;

  return new Set(
    source
      .map((origin) => normalizeOrigin(origin))
      .filter((origin): origin is string => Boolean(origin))
  );
};

export const createOriginPolicy = ({
  nodeEnv,
  corsAllowedOriginsRaw,
  wsAllowedOriginsRaw,
}: {
  nodeEnv: string;
  corsAllowedOriginsRaw?: string;
  wsAllowedOriginsRaw?: string;
}) => {
  const isLocalMode = nodeEnv === "development" || nodeEnv === "test";
  const fallbackOrigins = isLocalMode ? devDefaultOrigins : [];
  const corsAllowedOrigins = parseOriginAllowlist(corsAllowedOriginsRaw, fallbackOrigins);
  const wsAllowedOrigins = parseOriginAllowlist(
    wsAllowedOriginsRaw,
    wsAllowedOriginsRaw ? [] : [...corsAllowedOrigins]
  );

  return {
    corsAllowedOrigins,
    wsAllowedOrigins,
    isHttpOriginAllowed(origin: string) {
      const normalized = normalizeOrigin(origin);
      return normalized !== null && corsAllowedOrigins.has(normalized);
    },
    isWebSocketOriginAllowed(origin: string | null | undefined) {
      if (!origin) {
        return isLocalMode;
      }

      const normalized = normalizeOrigin(origin);

      if (!normalized) {
        return false;
      }

      return wsAllowedOrigins.has(normalized);
    },
  };
};

export type SecurityOriginPolicy = ReturnType<typeof createOriginPolicy>;

export const securityOriginPolicy = createOriginPolicy({
  nodeEnv: env.NODE_ENV,
  corsAllowedOriginsRaw: env.CORS_ALLOWED_ORIGINS,
  wsAllowedOriginsRaw: env.WS_ALLOWED_ORIGINS,
});
