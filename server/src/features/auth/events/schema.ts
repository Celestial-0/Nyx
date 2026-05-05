import { z } from "zod";
import { authEventTopics } from "@/features/auth/events/topics";

export const authSessionCreatedEventSchema = z.object({
  userId: z.string(),
  walletAddress: z.string(),
  sessionId: z.string(),
  firstSignIn: z.boolean(),
});

export const authSessionTerminatedEventSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
});

export const authProfileCompletedEventSchema = z.object({
  userId: z.string(),
  walletAddress: z.string(),
  username: z.string(),
  displayName: z.string(),
});

export const authWebSocketConnectedEventSchema = z.object({
  userId: z.string(),
  timestamp: z.string(),
});

export const authWebSocketDisconnectedEventSchema = z.object({
  userId: z.string(),
  timestamp: z.string(),
});

export const authEventSchemas = {
  [authEventTopics.sessionCreated]: authSessionCreatedEventSchema,
  [authEventTopics.sessionTerminated]: authSessionTerminatedEventSchema,
  [authEventTopics.profileCompleted]: authProfileCompletedEventSchema,
  [authEventTopics.websocketUserConnected]: authWebSocketConnectedEventSchema,
  [authEventTopics.websocketUserDisconnected]: authWebSocketDisconnectedEventSchema,
} as const;
