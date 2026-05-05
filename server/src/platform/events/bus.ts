import { logger } from "@/shared/logger";
import type { EventHandler, EventMap, EventPayload } from "@/platform/events/types";

export class EventBus<T extends EventMap> {
  private handlers: {
    [K in keyof T]?: Set<EventHandler<EventPayload<T, K>>>;
  } = {};

  private readonly log = logger.child({ module: "event-bus" });

  constructor(private readonly schemas: T) {}

  private validate<K extends keyof T>(event: K, payload: EventPayload<T, K>) {
    const schema = this.schemas[event];
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      this.log.warn(
        {
          event: String(event),
          issues: parsed.error.issues,
          payload,
        },
        "Invalid event payload"
      );

      throw new Error(`Invalid payload for "${String(event)}"`);
    }

    return parsed.data;
  }

  on<K extends keyof T>(event: K, handler: EventHandler<EventPayload<T, K>>) {
    if (!this.handlers[event]) {
      this.handlers[event] = new Set();
    }

    this.handlers[event]!.add(handler);
    this.log.debug({ event: String(event) }, "Handler subscribed");

    return () => {
      this.handlers[event]!.delete(handler);
      this.log.debug({ event: String(event) }, "Handler unsubscribed");

      if (this.handlers[event]!.size === 0) {
        delete this.handlers[event];
      }
    };
  }

  async emit<K extends keyof T>(event: K, payload: EventPayload<T, K>) {
    const parsed = this.validate(event, payload);

    const handlers = this.handlers[event];

    this.log.debug(
      {
        event: String(event),
        handlers: handlers?.size ?? 0,
      },
      "Event emitted"
    );

    if (!handlers || handlers.size === 0) {
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(parsed);
      } catch (err) {
        this.log.error({ event: String(event), err }, "Event handler failed");
      }
    }
  }

  async emitStrict<K extends keyof T>(event: K, payload: EventPayload<T, K>) {
    const parsed = this.validate(event, payload);
    const handlers = this.handlers[event];

    this.log.debug(
      {
        event: String(event),
        handlers: handlers?.size ?? 0,
      },
      "Strict event emitted"
    );

    if (!handlers || handlers.size === 0) {
      return;
    }

    for (const handler of handlers) {
      await handler(parsed);
    }
  }
}
