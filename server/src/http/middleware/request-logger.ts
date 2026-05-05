import type { MiddlewareHandler } from "hono";
import { abuseService } from "@/abuse/service";
import { observabilityMetrics, observabilityRequest } from "@/observability";
import type { AppBindings } from "@/types/global";
import { logger } from "@/shared/logger";

export const requestLogger: MiddlewareHandler<AppBindings> = async (c, next) => {
  const startedAt = performance.now();
  const method = c.req.method;
  const route = observabilityRequest.normalizeRouteLabel(c.req.path);
  const requestId = c.get("requestId");
  const clientFingerprint = abuseService.getClientFingerprintFromHeaders(c.req.raw.headers);

  observabilityMetrics.incrementHttpInFlight({ method, route });

  try {
    await next();
  } finally {
    observabilityMetrics.decrementHttpInFlight({ method, route });

    const durationMs = performance.now() - startedAt;
    const requestErrorCode = c.get("requestErrorCode");
    const statusCode = c.res.status;

    observabilityMetrics.observeHttpRequest({
      method,
      route,
      statusClass: observabilityRequest.getStatusClass(statusCode),
      durationMs,
    });

    if (requestErrorCode) {
      observabilityMetrics.incrementHttpError({
        route,
        errorCode: requestErrorCode,
      });
      return;
    }

    const userId = c.get("authUser")?.id;
    const logContext = {
      requestId,
      method,
      route,
      status: statusCode,
      latencyMs: Number(durationMs.toFixed(2)),
      ...(userId ? { userId } : {}),
      ...(clientFingerprint !== "unknown"
        ? { clientFingerprint }
        : {}),
    };

    if (durationMs >= 1000) {
      logger.warn(logContext, "Request completed slowly");
      return;
    }

    logger.info(logContext, "Request completed");
  }
};
