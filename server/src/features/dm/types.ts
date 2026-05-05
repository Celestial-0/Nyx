import type { z } from "zod";
import type { db } from "@/platform/db/client";
import type { EventBusLike } from "@/platform/events/types";
import type { dmEventSchemas } from "@/features/dm/events/schema";
import type { dmStartBodySchema } from "@/features/dm/schema";

export type DmDb = typeof db;

export type DmEventName = keyof typeof dmEventSchemas;
export type DmEventPayload<K extends DmEventName = DmEventName> = z.infer<
  (typeof dmEventSchemas)[K]
>;

export type DmEventBus = EventBusLike<typeof dmEventSchemas>;

export type DmStartInput = z.infer<typeof dmStartBodySchema>;
