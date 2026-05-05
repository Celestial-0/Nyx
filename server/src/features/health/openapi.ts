import { createRoute } from "@hono/zod-openapi";
import { healthSuccessResponseSchema } from "@/features/health/schema";
import { errorResponseSchema } from "@/http/openapi/schemas";

export const getHealthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Health check",
  description:
    "Checks whether the API is healthy and ready to serve traffic, including Postgres, Redis, and realtime subscriber readiness.",
  responses: {
    200: {
      description: "Service is healthy",
      content: {
        "application/json": {
          schema: healthSuccessResponseSchema,
        },
      },
    },
    503: {
      description: "Service is not ready",
      content: {
        "application/json": {
          schema: healthSuccessResponseSchema,
        },
      },
    },
    500: {
      description: "Unexpected server error",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});
