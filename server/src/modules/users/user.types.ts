import type { db } from "@/db/client";
import type { eventSchemas } from "@/events/schemas";
import type { usersUpdateMeRequestBodySchema } from "@/modules/users/users.schema";
import type { z } from "zod";

export type UsersDb = typeof db;

export type UsersEventName = keyof typeof eventSchemas;

export type UsersEventPayload<K extends UsersEventName = UsersEventName> = z.infer<
  (typeof eventSchemas)[K]
>;

export type UsersEventBus = {
  emit: <K extends UsersEventName>(event: K, payload: UsersEventPayload<K>) => Promise<void>;
};

export type UsersUpdateMeInput = typeof usersUpdateMeRequestBodySchema.static;

export type DbUser = {
  id: string;
  walletAddress: string;
  username: string | null;
  fullName: string | null;
  role: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
