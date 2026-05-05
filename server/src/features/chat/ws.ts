import { OpenAPIHono } from "@hono/zod-openapi";
import { upgradeWebSocket } from "hono/bun";
import { db } from "@/platform/db/client";
import { eventBus } from "@/platform/events";
import { chatRealtimeBridge } from "@/features/chat/realtime";
import { chatWebSocketQuerySchema } from "@/features/chat/schema";
import { chatService } from "@/features/chat/service";
import type { AppBindings } from "@/types/global";
import { logger } from "@/shared/logger";

const wsLog = logger.child({ module: "chat.ws" });

export const registerChatWebSocket = (app: OpenAPIHono<AppBindings>) => {
  chatService.registerMessagePipeline({
    eventBus,
    db,
  });

  chatService.registerEventFanout({
    eventBus,
  });

  void chatService.registerRealtimeBridge({
    eventBus,
    realtime: chatRealtimeBridge,
  });

  app.get(
    "/ws",
    upgradeWebSocket((c) => {
      const parsed = chatWebSocketQuerySchema.safeParse({
        token: c.req.query("token"),
        sharePresence: c.req.query("sharePresence"),
      });

      const db = c.get("db");
      const redis = c.get("redis");
      const jwt = c.get("jwt");
      const eventBus = c.get("eventBus");
      const origin = c.req.header("origin");
      let connectionId: string | null = null;

      return {
        onOpen: (_event, ws) => {
          void (async () => {
            if (!parsed.success) {
              ws.close(4001, "Unauthorized");
              return;
            }

            const opened = await chatService.openConnection({
              db,
              redis,
              jwt,
              eventBus,
              token: parsed.data.token,
              sharePresence: parsed.data.sharePresence ?? true,
              socket: ws,
              origin,
              realtime: chatRealtimeBridge,
            });

            connectionId = opened?.connectionId ?? null;

            if (connectionId) {
              wsLog.info({ connectionId, userId: opened?.user.id }, "WebSocket connected");
            }
          })().catch((error: Error) => {
            wsLog.error({ error }, "Failed to open websocket connection");
            ws.close(1011, "Internal server error");
          });
        },
        onMessage: (event, ws) => {
          void (async () => {
            if (!connectionId) {
              ws.close(4001, "Unauthorized");
              return;
            }

            await chatService.handleIncomingMessage({
              db,
              redis,
              eventBus,
              connectionId,
              rawMessage: event.data,
              realtime: chatRealtimeBridge,
            });
          })().catch((error: Error) => {
            wsLog.error({ connectionId, error }, "Failed to handle websocket message");
            ws.close(1011, "Internal server error");
          });
        },
        onClose: (event) => {
          if (!connectionId) {
            return;
          }

          const currentConnectionId = connectionId;

          void chatService
            .closeConnection({
              redis,
              eventBus,
              connectionId: currentConnectionId,
              closeCode: event.code,
              realtime: chatRealtimeBridge,
            })
            .catch((error: Error) => {
              wsLog.warn({ connectionId: currentConnectionId, error }, "Failed to close websocket");
            });

          wsLog.info({ connectionId: currentConnectionId, code: event.code }, "WebSocket disconnected");
        },
      };
    })
  );
};
