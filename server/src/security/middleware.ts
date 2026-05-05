import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "@/types/global";
import { securityOriginPolicy, type SecurityOriginPolicy } from "@/security/origin";
import { appendVaryHeader } from "@/security/headers";
import { Forbidden } from "@/shared/error";

const applyCorsHeaders = (c: Parameters<MiddlewareHandler<AppBindings>>[0], origin: string) => {
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Credentials", "true");
  c.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  c.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Request-Id"
  );
  c.header("Access-Control-Max-Age", "86400");
  c.header("Vary", appendVaryHeader(c.res.headers.get("Vary"), "Origin"));
};

export const createHttpOriginMiddleware = (
  originPolicy: SecurityOriginPolicy = securityOriginPolicy
): MiddlewareHandler<AppBindings> => {
  return async (c, next) => {
    const requestOrigin = c.req.header("Origin");

    if (requestOrigin) {
      if (!originPolicy.isHttpOriginAllowed(requestOrigin)) {
        throw Forbidden("Origin not allowed.");
      }

      applyCorsHeaders(c, requestOrigin);
    }

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }

    await next();

    if (requestOrigin) {
      applyCorsHeaders(c, requestOrigin);
    }
  };
};
