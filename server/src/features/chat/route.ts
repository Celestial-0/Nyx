import { OpenAPIHono } from "@hono/zod-openapi";
import {
  deleteMessageRoute,
  getConversationListRoute,
  getConversationMessagesRoute,
  hideMessageRoute,
} from "@/features/chat/openapi";
import { chatService } from "@/features/chat/service";
import type { AppBindings } from "@/types/global";
import { success } from "@/http/response";

export const chatRoutes = new OpenAPIHono<AppBindings>().basePath("/chat");

chatRoutes.openapi(getConversationListRoute, async (c) => {
  const authUser = c.get("authUser");

  const data = await chatService.getConversationList({
    db: c.get("db"),
    userId: authUser!.id,
    activeDeviceId: authUser!.activeDeviceId,
  });

  return c.json(success(data), 200);
});

chatRoutes.openapi(getConversationMessagesRoute, async (c) => {
  const authUser = c.get("authUser");
  const { conversationId } = c.req.valid("param");
  const query = c.req.valid("query");

  const data = await chatService.getConversationHistory({
    db: c.get("db"),
    conversationId,
    userId: authUser!.id,
    query,
  });

  return c.json(success(data), 200);
});

chatRoutes.openapi(hideMessageRoute, async (c) => {
  const authUser = c.get("authUser");
  const { messageId } = c.req.valid("param");

  const data = await chatService.hideMessageForUser({
    db: c.get("db"),
    messageId,
    userId: authUser!.id,
  });

  return c.json(success(data), 200);
});

chatRoutes.openapi(deleteMessageRoute, async (c) => {
  const authUser = c.get("authUser");
  const { messageId } = c.req.valid("param");

  const data = await chatService.deleteMessageForEveryone({
    db: c.get("db"),
    eventBus: c.get("eventBus"),
    messageId,
    userId: authUser!.id,
  });

  return c.json(success(data), 200);
});
