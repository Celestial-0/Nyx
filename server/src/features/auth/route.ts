import { OpenAPIHono } from "@hono/zod-openapi";
import {
  createNonceRoute,
  refreshRoute,
  sessionRoute,
  signoutRoute,
  verifySignatureRoute,
} from "@/features/auth/openapi";
import { authService } from "@/features/auth/service";
import type { AppBindings } from "@/types/global";
import { success } from "@/http/response";

export const authRoutes = new OpenAPIHono<AppBindings>().basePath("/auth");

authRoutes.openapi(createNonceRoute, async (c) => {
  const data = await authService.generateNonce({
    redis: c.get("redis"),
    input: c.req.valid("json"),
  });
  return c.json(success(data), 200);
});

authRoutes.openapi(verifySignatureRoute, async (c) => {
  const data = await authService.verifySignature({
    redis: c.get("redis"),
    db: c.get("db"),
    jwt: c.get("jwt"),
    input: c.req.valid("json"),
    eventBus: c.get("eventBus"),
  });

  return c.json(success(data), 200);
});

authRoutes.openapi(refreshRoute, async (c) => {
  const data = await authService.refreshAccessToken({
    redis: c.get("redis"),
    db: c.get("db"),
    jwt: c.get("jwt"),
    input: c.req.valid("json"),
    eventBus: c.get("eventBus"),
  });

  return c.json(success(data), 200);
});

authRoutes.openapi(sessionRoute, async (c) => {
  const authUser = c.get("authUser");

  if (!authUser) {
  return c.json(
    success({
      authenticated: false,
      user: null,
      activeDevice: null,
      prekeyStatus: null,
    }),
    200
  );
  }

  return c.json(
    success({
      authenticated: true,
      user: {
        id: authUser.id,
        walletAddress: authUser.walletAddress,
        role: authUser.role,
        activeDeviceId: authUser.activeDeviceId,
      },
      activeDevice: authUser.activeDevice,
      prekeyStatus: authUser.prekeyStatus,
    }),
    200
  );
});

authRoutes.openapi(signoutRoute, async (c) => {
  const authUser = c.get("authUser");
  const input = c.req.valid("json");

  const revokedDeviceId = await authService.signOutSession({
    redisClient: c.get("redis"),
    db: c.get("db"),
    sessionId: authUser!.sessionId,
    userId: authUser!.id,
    deviceId: authUser!.activeDeviceId,
    revokeDevice: input?.revokeDevice === true,
    eventBus: c.get("eventBus"),
  });

  return c.json(success({ signedOut: true as const, revokedDeviceId }), 200);
});
