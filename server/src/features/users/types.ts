import type { z } from "zod";
import type { db } from "@/platform/db/client";
import type { EventBusLike } from "@/platform/events/types";
import type { authProfileCompletedEventSchema } from "@/features/auth/events/schema";
import { authEventTopics } from "@/features/auth/events/topics";
import type { usersUpdateMeBodySchema } from "@/features/users/schema";

export type UsersDb = typeof db;

type UsersEventSchemas = {
  [authEventTopics.profileCompleted]: typeof authProfileCompletedEventSchema;
};

export type UsersEventName = keyof UsersEventSchemas;
export type UsersEventPayload<K extends UsersEventName = UsersEventName> = z.infer<
  UsersEventSchemas[K]
>;

export type UsersEventBus = EventBusLike<UsersEventSchemas>;

export type UsersUpdateMeInput = z.infer<typeof usersUpdateMeBodySchema>;

export type DbUser = {
  id: string;
  walletAddress: string;
  username: string | null;
  fullName: string | null;
  role: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
