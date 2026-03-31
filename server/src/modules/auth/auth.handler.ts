import { Elysia, t } from "elysia";
import type { NyxSharedContext } from "@/types/global";
import {
  authNonceRequestBodySchema,
  authNonceSuccessResponseSchema,
  authRefreshRequestBodySchema,
  authRefreshSuccessResponseSchema,
  authSessionSuccessResponseSchema,
  authSignoutSuccessResponseSchema,
  authVerifyRequestBodySchema,
  authVerifySuccessResponseSchema,
} from "@/modules/auth/auth.schema";
import { success } from "@/utils/response";
import { authService } from "@/modules/auth/auth.service";
import { logger } from "@/utils/logger";
import { Unauthorized } from "@/utils/error";

const wsLog = logger.child({ module: "auth.handler.ws" });

const authNonceMeta = {
  detail: {
    tags: ["Auth"],
    summary: "Create wallet nonce",
    description: "Generates a short-lived, single-use nonce + SIWS message for wallet signature.",
    operationId: "createAuthNonce",
  },
  body: authNonceRequestBodySchema,
  response: {
    200: authNonceSuccessResponseSchema,
  },
};

const authVerifyMeta = {
  detail: {
    tags: ["Auth"],
    summary: "Verify wallet signature",
    description:
      "Verifies signed SIWS message + nonce, prevents replay, and returns authenticated tokens.",
    operationId: "verifyAuthSignature",
  },
  body: authVerifyRequestBodySchema,
  response: {
    200: authVerifySuccessResponseSchema,
  },
};

const authSessionMeta = {
  detail: {
    tags: ["Auth"],
    summary: "Get current auth session",
    description: "Validates bearer token and returns current authenticated user state.",
    operationId: "getAuthSession",
  },
  auth: { optional: true },
  response: {
    200: authSessionSuccessResponseSchema,
  },
};

const authRefreshMeta = {
  detail: {
    tags: ["Auth"],
    summary: "Refresh access token",
    description: "Validates refresh token and mints a new access token.",
    operationId: "postAuthRefresh",
  },
  body: authRefreshRequestBodySchema,
  response: {
    200: authRefreshSuccessResponseSchema,
  },
};

const authSignoutMeta = {
  detail: {
    tags: ["Auth"],
    summary: "Sign out current session",
    description: "Invalidates the current bearer token session.",
    operationId: "postAuthSignout",
  },
  auth: true,
  response: {
    200: authSignoutSuccessResponseSchema,
  },
};

export const authHandler = new Elysia<
  "",
  NyxSharedContext["singleton"],
  NyxSharedContext["definitions"],
  NyxSharedContext["metadata"]
>({
  name: "auth.handler",
})
  .post(
    "/auth/nonce",
    async ({ body, redis }) => {
      const data = await authService.generateNonce(redis, body);
      return success(data);
    },
    authNonceMeta
  )
  .post(
    "/auth/verify",
    async ({ body, redis, db, jwt, eventBus }) => {
      const data = await authService.verifySignature(
        redis,
        db,
        jwt,
        body,
        eventBus as Parameters<typeof authService.verifySignature>[4]
      );
      return success(data);
    },
    authVerifyMeta
  )
  .post(
    "/auth/refresh",
    async ({ body, redis, db, jwt, eventBus }) => {
      const data = await authService.refreshAccessToken(
        redis,
        db,
        jwt,
        body,
        eventBus as Parameters<typeof authService.refreshAccessToken>[4]
      );
      return success(data);
    },
    authRefreshMeta
  )
  .get(
    "/auth/session",
    async (ctx) => {
      const authUser = ctx.authUser;

      if (!authUser) {
        return success({
          authenticated: false,
          user: null,
        });
      }

      return success({
        authenticated: true,
        user: {
          id: authUser.id,
          walletAddress: authUser.walletAddress,
          role: authUser.role,
        },
      });
    },
    authSessionMeta
  )
  .post(
    "/auth/signout",
    async (ctx) => {
      const authUser = ctx.authUser;
      if (!authUser) {
        throw Unauthorized("Authentication required.");
      }

      const { redis, eventBus } = ctx;
      await authService.signOutSession({
        redisClient: redis,
        sessionId: authUser.sessionId,
        userId: authUser.id,
        eventBus: eventBus as Parameters<typeof authService.signOutSession>[0]["eventBus"],
      });
      return success({ signedOut: true as const });
    },
    authSignoutMeta
  )
  .ws("/ws", {
    query: t.Object({
      token: t.String({ minLength: 10 }),
    }),
    async open(ws) {
      const token = ws.data?.query?.token;

      if (!token) {
        ws.close(4001, "Unauthorized");
        return;
      }

      const authUser = await authService.resolveSessionFromToken({
        jwt: ws.data.jwt,
        redis: ws.data.redis,
        db: ws.data.db,
        token,
      });

      if (!authUser) {
        ws.close(4001, "Unauthorized");
        return;
      }

      ws.data.authUser = authUser;
      wsLog.info({ userId: authUser.id }, "WebSocket authenticated");

      try {
        await ws.data.eventBus.emit("websocket:user:connected", {
          userId: authUser.id,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        wsLog.warn({ userId: authUser.id, error }, "Failed to emit ws connect event");
      }
    },
    message(ws, rawMessage) {
      if (!ws.data?.authUser) {
        ws.close(4001, "Unauthorized");
        return;
      }

      if (typeof rawMessage === "string" && rawMessage === "ping") {
        ws.send("pong");
      }
    },
    close(ws) {
      const userId = ws.data?.authUser?.id;
      if (userId) {
        wsLog.info({ userId }, "WebSocket disconnected");
        ws.data.eventBus
          ?.emit("websocket:user:disconnected", {
            userId,
            timestamp: new Date().toISOString(),
          })
          .catch((error: Error) => {
            wsLog.warn({ userId, error }, "Failed to emit ws disconnect event");
          });
      }
    },
  });
