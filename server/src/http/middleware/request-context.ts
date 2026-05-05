import type { MiddlewareHandler } from "hono";
import { observabilityRequest } from "@/observability";
import type { AppBindings } from "@/types/global";

export const requestContext: MiddlewareHandler<AppBindings> = async (c, next) => {
  const requestId = observabilityRequest.resolveRequestId(c.req.raw.headers);

  c.set("requestId", requestId);
  c.header("x-request-id", requestId);

  await next();

  c.header("x-request-id", requestId);
};
