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
  "message:created": z.object({
    id: z.string(),
    senderId: z.string(),
    text: z.string(),
    createdAt: z.string(),
  }).and(contextSchema),

  "message:deleted": z.object({
    id: z.string(),
  }).and(contextSchema),

  "message:read": z.object({
    messageId: z.string(),
    userId: z.string(),
  }).and(contextSchema),

  // PRESENCE
  "user:online": z.object({
    userId: z.string(),
  }),

  "user:offline": z.object({
    userId: z.string(),
  }),

  // TYPING
  "user:typing:start": z.object({
    userId: z.string(),
  }).and(contextSchema),

  "user:typing:stop": z.object({
    userId: z.string(),
  }).and(contextSchema),

  // ROOM
  "room:joined": z.object({
    roomId: z.string(),
    userId: z.string(),
  }),

  "room:left": z.object({
    roomId: z.string(),
    userId: z.string(),
  }),
};