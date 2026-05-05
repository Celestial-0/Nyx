import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "@/types/global";

export const appendVaryHeader = (currentValue: string | null, nextValue: string) => {
  if (!currentValue) {
    return nextValue;
  }

  const entries = new Set(
    currentValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

  entries.add(nextValue);

  return [...entries].join(", ");
};

export const securityHeaders: MiddlewareHandler<AppBindings> = async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Frame-Options", "DENY");
};

export const noStoreResponse: MiddlewareHandler<AppBindings> = async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
};
