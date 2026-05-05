import type { MiddlewareHandler } from "hono";
import { authService } from "@/features/auth/service";
import type { AppBindings } from "@/types/global";
import { Unauthorized } from "@/shared/error";

const extractBearerToken = (authorization?: string | null): string | null => {
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;

  return bearer && bearer.length > 0 ? bearer : null;
};

const resolveAuthUser = async (
  c: Parameters<MiddlewareHandler<AppBindings>>[0]
) => {
  const token = extractBearerToken(c.req.header("Authorization"));

  if (!token) {
    return null;
  }

  return authService.resolveSessionFromToken({
    jwt: c.get("jwt"),
    redis: c.get("redis"),
    db: c.get("db"),
    token,
  });
};

export const optionalAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  c.set("authUser", await resolveAuthUser(c));
  await next();
};

export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = await resolveAuthUser(c);

  if (!user) {
    throw Unauthorized("Authentication required.");
  }

  c.set("authUser", user);
  await next();
};
