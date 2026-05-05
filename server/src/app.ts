import { OpenAPIHono } from "@hono/zod-openapi";
import { authRoutes } from "@/features/auth/route";
import { chatRoutes } from "@/features/chat/route";
import { contactRoutes } from "@/features/contacts/route";
import { registerChatWebSocket } from "@/features/chat/ws";
import { dmRoutes } from "@/features/dm/route";
import { healthRoutes } from "@/features/health/route";
import { paymentRoutes } from "@/features/payments/route";
import { roomRoutes } from "@/features/rooms/route";
import { userRoutes } from "@/features/users/route";
import {
  attachServices,
  requestContext,
  requestLogger,
} from "@/http/middleware";
import { observabilityMetrics, observabilityRequest } from "@/observability";
import { createHttpOriginMiddleware, noStoreResponse, securityHeaders } from "@/security";
import type { AppBindings } from "@/types/global";
import { AppError, AppErrorStatus } from "@/shared/error";
import { logger } from "@/shared/logger";

export const app = new OpenAPIHono<AppBindings>();
const httpOriginMiddleware = createHttpOriginMiddleware();

app.use("*", attachServices);
app.use("*", requestContext);
app.use("*", requestLogger);
app.use("*", securityHeaders);
app.use("/", httpOriginMiddleware);
app.use("/docs", httpOriginMiddleware);
app.use("/health", httpOriginMiddleware);
app.use("/metrics", httpOriginMiddleware);
app.use("/auth/*", httpOriginMiddleware);
app.use("/users/*", httpOriginMiddleware);
app.use("/chat/*", httpOriginMiddleware);
app.use("/contacts/*", httpOriginMiddleware);
app.use("/rooms/*", httpOriginMiddleware);
app.use("/dm/*", httpOriginMiddleware);
app.use("/payments/*", httpOriginMiddleware);
app.use("/auth/*", noStoreResponse);
app.use("/payments/*", noStoreResponse);

app.doc("/docs", {
  openapi: "3.0.0",
  info: {
    title: "Nyx API",
    version: "0.1.0",
    description: "Anonymous decentralized Chat App",
  },
  tags: [
    { name: "Health", description: "System checks" },
    { name: "Auth", description: "Wallet authentication flow" },
    { name: "Users", description: "User identity and profile endpoints" },
    { name: "Chat", description: "Conversation history and realtime messaging" },
    { name: "Contacts", description: "Private saved contacts and aliases" },
    { name: "Rooms", description: "Group room lifecycle and membership endpoints" },
    { name: "DM", description: "Direct conversation resolution endpoints" },
    { name: "Payments", description: "Credits balance and Solana recharge endpoints" },
  ],
});

app.get("/metrics", async (c) => {
  c.header("Content-Type", observabilityMetrics.contentType);
  return c.body(await observabilityMetrics.getMetricsPayload());
});

app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", userRoutes);
app.route("/", chatRoutes);
app.route("/", contactRoutes);
app.route("/", roomRoutes);
app.route("/", dmRoutes);
app.route("/", paymentRoutes);
registerChatWebSocket(app);
app.get("/", (c) => c.text("Welcome to Nyx API"));

app.notFound((c) =>
  c.json(
    {
      success: false,
      error: "NOT_FOUND",
      message: "Route not found",
      details: null,
    },
    404
  )
);

app.onError((error, c) => {
  let status: AppErrorStatus = 500;
  let response = {
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong",
    details: undefined as unknown,
  };

  if (error instanceof AppError) {
    status = error.statusCode as AppErrorStatus;
    response = {
      success: false,
      error: error.code,
      message: error.message,
      details: error.details,
    };
  }

  logger.error(
    {
      requestId: c.get("requestId"),
      method: c.req.method,
      route: observabilityRequest.normalizeRouteLabel(c.req.path),
      path: c.req.path,
      status,
      userId: c.get("authUser")?.id ?? null,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    },
    "Request error"
  );

  c.set("requestErrorCode", response.error);
  c.header("x-request-id", c.get("requestId"));

  if (
    response.error === "RATE_LIMITED" &&
    response.details &&
    typeof response.details === "object" &&
    response.details !== null &&
    "retryAfterMs" in response.details &&
    typeof (response.details as { retryAfterMs?: unknown }).retryAfterMs === "number"
  ) {
    const retryAfterMs = (response.details as { retryAfterMs: number }).retryAfterMs;
    c.header("Retry-After", Math.max(1, Math.ceil(retryAfterMs / 1000)).toString());
  }

  return c.json(response, status);
});
