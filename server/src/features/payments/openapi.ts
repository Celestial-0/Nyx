import { createRoute } from "@hono/zod-openapi";
import { abusePolicies } from "@/abuse/policies";
import { abuseService } from "@/abuse/service";
import { createAbuseProtectionMiddleware } from "@/abuse/middleware";
import { requireAuth } from "@/http/middleware/auth";
import {
  paymentCreditsSuccessResponseSchema,
  paymentRechargeVerifyBodySchema,
  paymentRechargeVerifySuccessResponseSchema,
} from "@/features/payments/schema";
import { errorResponseSchema } from "@/http/openapi/schemas";

const paymentsRechargeAbuseMiddleware = createAbuseProtectionMiddleware({
  policy: abusePolicies.paymentsRechargeVerify,
  resolveSubject: (c) => abuseService.createUserSubject(c.get("authUser")!.id),
});

export const getCreditsRoute = createRoute({
  method: "get",
  path: "/credits",
  tags: ["Payments"],
  summary: "Get current credit balance",
  middleware: requireAuth,
  responses: {
    200: {
      description: "Current credits balance",
      content: {
        "application/json": {
          schema: paymentCreditsSuccessResponseSchema,
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

export const verifyRechargeRoute = createRoute({
  method: "post",
  path: "/recharge/verify",
  tags: ["Payments"],
  summary: "Verify a Solana recharge transaction and credit the user",
  middleware: [requireAuth, paymentsRechargeAbuseMiddleware],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: paymentRechargeVerifyBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Recharge verified",
      content: {
        "application/json": {
          schema: paymentRechargeVerifySuccessResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid transaction or verification request",
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
    409: {
      description: "Transaction already used",
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
  },
});
