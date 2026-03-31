import { z } from "zod";

// must follow domain:entity:action pattern

// Shared context (DRY)

const contextSchema = z.object({
  roomId: z.string().optional(),
  chatId: z.string().optional(),
}).refine((d) => d.roomId || d.chatId, {
  message: "Context required (roomId or chatId)",
}).refine((d) => !(d.roomId && d.chatId), {
  message: "Only one of roomId or chatId allowed",
});

export const eventSchemas = {
  // MESSAGE
  "chat:message:created": z.object({
    id: z.string(),
    senderId: z.string(),
    text: z.string(),
    createdAt: z.string(),
  }).and(contextSchema),

  "chat:message:deleted": z.object({
    id: z.string(),
  }).and(contextSchema),

  "chat:message:read": z.object({
    messageId: z.string(),
    userId: z.string(),
  }).and(contextSchema),

  // PRESENCE
  "presence:user:online": z.object({
    userId: z.string(),
  }),

  "presence:user:offline": z.object({
    userId: z.string(),
  }),

  // TYPING
  "presence:typing:started": z.object({
    userId: z.string(),
  }).and(contextSchema),

  "presence:typing:stopped": z.object({
    userId: z.string(),
  }).and(contextSchema),

  // ROOM
  "chat:room:joined": z.object({
    roomId: z.string(),
    userId: z.string(),
  }),

  "chat:room:left": z.object({
    roomId: z.string(),
    userId: z.string(),
  }),

  // AUTH
  "auth:session:created": z.object({
    userId: z.string(),
    walletAddress: z.string(),
    sessionId: z.string(),
    firstSignIn: z.boolean(),
  }),

  "auth:session:terminated": z.object({
    userId: z.string(),
    sessionId: z.string(),
  }),

  "auth:profile:completed": z.object({
    userId: z.string(),
    walletAddress: z.string(),
    username: z.string(),
    displayName: z.string(),
  }),

  // WEBSOCKET
  "websocket:user:connected": z.object({
    userId: z.string(),
    timestamp: z.string(),
  }),

  "websocket:user:disconnected": z.object({
    userId: z.string(),
    timestamp: z.string(),
  }),
};