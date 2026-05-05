import { OpenAPIHono } from "@hono/zod-openapi";
import { getCreditsRoute, verifyRechargeRoute } from "@/features/payments/openapi";
import { paymentsService } from "@/features/payments/service";
import type { AppBindings } from "@/types/global";
import { success } from "@/http/response";

export const paymentRoutes = new OpenAPIHono<AppBindings>().basePath("/payments");

paymentRoutes.openapi(getCreditsRoute, async (c) => {
  const authUser = c.get("authUser");
  const data = await paymentsService.getCreditsBalance({
    db: c.get("db"),
    userId: authUser!.id,
  });

  return c.json(success(data), 200);
});

paymentRoutes.openapi(verifyRechargeRoute, async (c) => {
  const authUser = c.get("authUser");
  const data = await paymentsService.verifyRecharge({
    db: c.get("db"),
    userId: authUser!.id,
    walletAddress: authUser!.walletAddress,
    input: c.req.valid("json"),
    eventBus: c.get("eventBus"),
  });

  return c.json(success(data), 200);
});
