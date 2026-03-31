import { EventBus } from "@/events/bus";
import { eventSchemas } from "@/events/schemas";

export const eventBus = new EventBus(eventSchemas);