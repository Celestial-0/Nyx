import type { z } from "zod";

export type EventMap = Record<string, z.ZodType>;
export type EventPayload<T extends EventMap, K extends keyof T> = z.infer<T[K]>;
export type EventHandler<T> = (payload: T) => void | Promise<void>;

export type EventBusLike<T extends EventMap> = {
  emit: <K extends keyof T>(event: K, payload: EventPayload<T, K>) => Promise<void>;
};
