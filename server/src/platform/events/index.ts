import { EventBus } from "@/platform/events/bus";
import { eventSchemas } from "@/platform/events/registry";

export const eventBus = new EventBus(eventSchemas);
