import { OpenAPIHono } from "@hono/zod-openapi";
import { startConversationRoute } from "@/features/dm/openapi";
import { dmService } from "@/features/dm/service";
import type { AppBindings } from "@/types/global";
import { success } from "@/http/response";

export const dmRoutes = new OpenAPIHono<AppBindings>().basePath("/dm");

dmRoutes.openapi(startConversationRoute, async (c) => {
  const authUser = c.get("authUser");
  const data = await dmService.startConversation({
    db: c.get("db"),
    currentUserId: authUser!.id,
    input: c.req.valid("json"),
    eventBus: c.get("eventBus"),
  });

  return c.json(success(data), 200);
});
