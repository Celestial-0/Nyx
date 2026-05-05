import { createRoute } from "@hono/zod-openapi";
import { requireAuth } from "@/http/middleware/auth";
import { dmStartBodySchema, dmStartSuccessResponseSchema } from "@/features/dm/schema";
import { errorResponseSchema } from "@/http/openapi/schemas";

export const startConversationRoute = createRoute({
  method: "post",
  path: "/start",
  tags: ["DM"],
  summary: "Start or resolve a direct conversation",
  middleware: requireAuth,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: dmStartBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Resolved direct conversation",
      content: {
        "application/json": {
          schema: dmStartSuccessResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid DM request",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: "Target user not found",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    422: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});
