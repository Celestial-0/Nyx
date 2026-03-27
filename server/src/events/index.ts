import { EventBus } from "@/events/event-bus";
import { eventSchemas } from "@/events/schemas";

export const eventBus = new EventBus(eventSchemas);