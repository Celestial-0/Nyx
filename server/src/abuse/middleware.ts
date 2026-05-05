import type { MiddlewareHandler } from "hono";
import { abuseService } from "@/abuse/service";
import type { AbuseRateLimitPolicy } from "@/abuse/types";
import type { AppBindings } from "@/types/global";
import { RateLimited } from "@/shared/error";

type SubjectResolver = (
  c: Parameters<MiddlewareHandler<AppBindings>>[0]
) => Promise<string> | string;

export const createAbuseProtectionMiddleware = ({
  policy,
  resolveSubject,
}: {
  policy: AbuseRateLimitPolicy;
  resolveSubject: SubjectResolver;
}): MiddlewareHandler<AppBindings> => async (c, next) => {
  const subject = await resolveSubject(c);
  const result = await abuseService.consumePolicy({
    redis: c.get("redis"),
    policy,
    subject,
  });

  if (!result.allowed) {
    throw RateLimited({
      retryAfterMs: result.retryAfterMs,
      scope: result.scope,
    });
  }

  await next();
};
