import { createRoute } from "@hono/zod-openapi";
import { abusePolicies } from "@/abuse/policies";
import { abuseService } from "@/abuse/service";
import { createAbuseProtectionMiddleware } from "@/abuse/middleware";
import { requireAuth } from "@/http/middleware/auth";
import {
  usersLookupQuerySchema,
  usersProfileSuccessResponseSchema,
  usersSearchQuerySchema,
  usersSearchSuccessResponseSchema,
  usersUpdateMeBodySchema,
} from "@/features/users/schema";
import { errorResponseSchema } from "@/http/openapi/schemas";

const usersDiscoveryAbuseMiddleware = createAbuseProtectionMiddleware({
  policy: abusePolicies.usersDiscovery,
  resolveSubject: (c) =>
    abuseService.createClientSubject(
      abuseService.getClientFingerprintFromHeaders(c.req.raw.headers)
    ),
});

export const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Users"],
  summary: "Get current user profile",
  middleware: requireAuth,
  responses: {
    200: {
      description: "Current user profile",
      content: {
        "application/json": {
          schema: usersProfileSuccessResponseSchema,
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
  },
});

export const updateMeRoute = createRoute({
  method: "patch",
  path: "/me",
  tags: ["Users"],
  summary: "Update current user profile",
  middleware: requireAuth,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: usersUpdateMeBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated user profile",
      content: {
        "application/json": {
          schema: usersProfileSuccessResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid profile update",
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

export const lookupRoute = createRoute({
  method: "get",
  path: "/lookup",
  tags: ["Users"],
  summary: "Lookup user by username or wallet",
  middleware: usersDiscoveryAbuseMiddleware,
  request: {
    query: usersLookupQuerySchema,
  },
  responses: {
    200: {
      description: "Matched user profile",
      content: {
        "application/json": {
          schema: usersProfileSuccessResponseSchema,
        },
      },
    },
    429: {
      description: "Rate limited",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: "User not found",
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

export const searchRoute = createRoute({
  method: "get",
  path: "/search",
  tags: ["Users"],
  summary: "Search users",
  middleware: usersDiscoveryAbuseMiddleware,
  request: {
    query: usersSearchQuerySchema,
  },
  responses: {
    200: {
      description: "User search results",
      content: {
        "application/json": {
          schema: usersSearchSuccessResponseSchema,
        },
      },
    },
    429: {
      description: "Rate limited",
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
