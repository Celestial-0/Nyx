import { z } from "zod";
import { logger } from "@/utils/logger";

type EventMap = Record<string, z.ZodType>;

type InferPayload<T extends EventMap, K extends keyof T> = z.infer<T[K]>;

type EventHandler<T> = (payload: T) => void | Promise<void>;

export class EventBus<T extends EventMap> {
  private handlers: {
    [K in keyof T]?: Set<EventHandler<InferPayload<T, K>>>;
  } = {};

  private log = logger.child({ module: "event-bus" });

  constructor(private schemas: T) {}

  /**
   * Subscribe to event
   */
  on<K extends keyof T>(
    event: K,
    handler: EventHandler<InferPayload<T, K>>
  ) {
    if (!this.handlers[event]) {
      this.handlers[event] = new Set();
    }

    this.handlers[event]!.add(handler);

    this.log.debug(
      { event: String(event) },
      "Handler subscribed"
    );

    return () => {
      this.handlers[event]!.delete(handler);

      this.log.debug(
        { event: String(event) },
        "Handler unsubscribed"
      );

      if (this.handlers[event]!.size === 0) {
        delete this.handlers[event];
      }
    };
  }

  /**
   * Emit event (sequential)
   */
  async emit<K extends keyof T>(
    event: K,
    payload: InferPayload<T, K>
  ) {
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

    const handlers = this.handlers[event];

    this.log.debug(
      {
        event: String(event),
        handlers: handlers?.size || 0,
      },
      "Event emitted"
    );

    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      try {
        await handler(parsed.data);
      } catch (err) {
        this.log.error(
          {
            event: String(event),
            err,
          },
          "Event handler failed"
        );
      }
    }
  }

  /**
   * Emit in parallel (faster for independent handlers)
   */
  async emitParallel<K extends keyof T>(
    event: K,
    payload: InferPayload<T, K>
  ) {
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

    const handlers = this.handlers[event];

    this.log.debug(
      {
        event: String(event),
        handlers: handlers?.size || 0,
      },
      "Event emitted (parallel)"
    );

    if (!handlers || handlers.size === 0) return;

    await Promise.allSettled(
      [...handlers].map(async (handler) => {
        try {
          await handler(parsed.data);
        } catch (err) {
          this.log.error(
            {
              event: String(event),
              err,
            },
            "Parallel handler failed"
          );
        }
      })
    );
  }

  /**
   * Remove handlers
   */
  clear(event?: keyof T) {
    if (event) {
      delete this.handlers[event];

      this.log.info(
        { event: String(event) },
        "Cleared handlers for event"
      );
    } else {
      this.handlers = {};

      this.log.info("Cleared all event handlers");
    }
  }
}