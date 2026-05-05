import { createRoute } from "@hono/zod-openapi";
import { abusePolicies } from "@/abuse/policies";
import { abuseService } from "@/abuse/service";
import { createAbuseProtectionMiddleware } from "@/abuse/middleware";
import { optionalAuth, requireAuth } from "@/http/middleware/auth";
import {
  authNonceRequestBodySchema,
  authNonceSuccessResponseSchema,
  authRefreshRequestBodySchema,
  authRefreshSuccessResponseSchema,
  authSessionSuccessResponseSchema,
  authSignoutRequestBodySchema,
  authSignoutSuccessResponseSchema,
  authVerifyRequestBodySchema,
  authVerifySuccessResponseSchema,
} from "@/features/auth/schema";
import { errorResponseSchema } from "@/http/openapi/schemas";

const getWalletAddressFromBodyClone = async (request: Request) => {
  try {
    const payload = (await request.clone().json()) as { walletAddress?: unknown };

    return typeof payload.walletAddress === "string" && payload.walletAddress.trim().length > 0
      ? payload.walletAddress.trim()
      : "unknown";
  } catch {
    return "unknown";
  }
};

const authNonceAbuseMiddleware = createAbuseProtectionMiddleware({
  policy: abusePolicies.authNonce,
  resolveSubject: async (c) => {
    const fingerprint = abuseService.getClientFingerprintFromHeaders(c.req.raw.headers);
    const walletAddress = await getWalletAddressFromBodyClone(c.req.raw);

    return abuseService.createWalletClientSubject(fingerprint, walletAddress);
  },
});

const authVerifyAbuseMiddleware = createAbuseProtectionMiddleware({
  policy: abusePolicies.authVerify,
  resolveSubject: async (c) => {
    const fingerprint = abuseService.getClientFingerprintFromHeaders(c.req.raw.headers);
    const walletAddress = await getWalletAddressFromBodyClone(c.req.raw);

    return abuseService.createWalletClientSubject(fingerprint, walletAddress);
  },
});

export const createNonceRoute = createRoute({
  method: "post",
  path: "/nonce",
  tags: ["Auth"],
  summary: "Create wallet nonce",
  description: "Generates a short-lived, single-use nonce and SIWS message for wallet signature.",
  middleware: authNonceAbuseMiddleware,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: authNonceRequestBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Nonce created",
      content: {
        "application/json": {
          schema: authNonceSuccessResponseSchema,
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

export const verifySignatureRoute = createRoute({
  method: "post",
  path: "/verify",
  tags: ["Auth"],
  summary: "Verify wallet signature",
  description: "Verifies the signed SIWS message, prevents replay, and returns authenticated tokens.",
  middleware: authVerifyAbuseMiddleware,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: authVerifyRequestBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Wallet verified",
      content: {
        "application/json": {
          schema: authVerifySuccessResponseSchema,
        },
      },
    },
    400: {
      description: "Verification failed",
      content: {
        "application/json": {
          schema: errorResponseSchema,
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

export const refreshRoute = createRoute({
  method: "post",
  path: "/refresh",
  tags: ["Auth"],
  summary: "Refresh access token",
  description: "Validates a refresh token, rotates it, and mints new access and refresh tokens.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: authRefreshRequestBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Tokens refreshed",
      content: {
        "application/json": {
          schema: authRefreshSuccessResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid refresh token",
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

export const sessionRoute = createRoute({
  method: "get",
  path: "/session",
  tags: ["Auth"],
  summary: "Get current auth session",
  description: "Validates the bearer token when present and returns the current session state.",
  middleware: optionalAuth,
  responses: {
    200: {
      description: "Current authentication state",
      content: {
        "application/json": {
          schema: authSessionSuccessResponseSchema,
        },
      },
    },
  },
});

export const signoutRoute = createRoute({
  method: "post",
  path: "/signout",
  tags: ["Auth"],
  summary: "Sign out current session",
  description: "Invalidates the current bearer token session.",
  middleware: requireAuth,
  request: {
    body: {
      required: false,
      content: {
        "application/json": {
          schema: authSignoutRequestBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Session signed out",
      content: {
        "application/json": {
          schema: authSignoutSuccessResponseSchema,
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
