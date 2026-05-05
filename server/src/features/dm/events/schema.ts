import { z } from "zod";
import { dmEventTopics } from "@/features/dm/events/topics";

export const dmEventSchemas = {
  [dmEventTopics.conversationCreated]: z.object({
    roomId: z.string(),
    userAId: z.string(),
    userBId: z.string(),
    timestamp: z.string(),
  }),
  [dmEventTopics.conversationResolved]: z.object({
    roomId: z.string(),
    userAId: z.string(),
    userBId: z.string(),
    created: z.boolean(),
    timestamp: z.string(),
  }),
} as const;
