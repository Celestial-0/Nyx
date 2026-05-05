import { z } from "zod";
import { roomsEventTopics } from "@/features/rooms/events/topics";

export const roomsEventSchemas = {
  [roomsEventTopics.roomCreated]: z.object({
    roomId: z.string(),
    type: z.enum(["group", "direct"]),
    createdBy: z.string(),
    timestamp: z.string(),
  }),
  [roomsEventTopics.membershipJoined]: z.object({
    roomId: z.string(),
    userId: z.string(),
    role: z.enum(["admin", "member"]),
    timestamp: z.string(),
  }),
  [roomsEventTopics.membershipLeft]: z.object({
    roomId: z.string(),
    userId: z.string(),
    timestamp: z.string(),
  }),
} as const;
