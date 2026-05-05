import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

const httpLabelNames = ["method", "route"] as const;
const httpResponseLabelNames = ["method", "route", "status_class"] as const;
const httpErrorLabelNames = ["route", "error_code"] as const;
const websocketRejectionLabelNames = ["type", "code"] as const;
const websocketMessageLabelNames = ["type"] as const;
const fanoutLabelNames = ["source", "event"] as const;
const abuseLabelNames = ["policy", "transport"] as const;
const dependencyLabelNames = ["service"] as const;

const registry = new Registry();

collectDefaultMetrics({
  register: registry,
  prefix: "nyx_",
});

const httpRequestsTotal = new Counter({
  name: "nyx_http_requests_total",
  help: "Total HTTP requests completed.",
  labelNames: [...httpResponseLabelNames],
  registers: [registry],
});

const httpRequestDurationSeconds = new Histogram({
  name: "nyx_http_request_duration_seconds",
  help: "HTTP request duration in seconds.",
  labelNames: [...httpResponseLabelNames],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

const httpRequestsInFlight = new Gauge({
  name: "nyx_http_requests_in_flight",
  help: "Current number of in-flight HTTP requests.",
  labelNames: [...httpLabelNames],
  registers: [registry],
});

const httpErrorsTotal = new Counter({
  name: "nyx_http_errors_total",
  help: "Total HTTP request errors.",
  labelNames: [...httpErrorLabelNames],
  registers: [registry],
});

const wsConnectionsActive = new Gauge({
  name: "nyx_ws_connections_active",
  help: "Current number of active websocket connections.",
  registers: [registry],
});

const wsConnectionsOpenedTotal = new Counter({
  name: "nyx_ws_connections_opened_total",
  help: "Total websocket connections opened.",
  registers: [registry],
});

const wsConnectionsClosedTotal = new Counter({
  name: "nyx_ws_connections_closed_total",
  help: "Total websocket connections closed.",
  labelNames: ["code"],
  registers: [registry],
});

const wsMessagesInTotal = new Counter({
  name: "nyx_ws_messages_in_total",
  help: "Total inbound websocket messages.",
  labelNames: [...websocketMessageLabelNames],
  registers: [registry],
});

const wsMessagesOutTotal = new Counter({
  name: "nyx_ws_messages_out_total",
  help: "Total outbound websocket messages.",
  labelNames: [...websocketMessageLabelNames],
  registers: [registry],
});

const wsMessageRejectionsTotal = new Counter({
  name: "nyx_ws_message_rejections_total",
  help: "Total websocket message rejections and socket error frames.",
  labelNames: [...websocketRejectionLabelNames],
  registers: [registry],
});

const chatSubscriptionsActive = new Gauge({
  name: "nyx_chat_subscriptions_active",
  help: "Current number of active chat conversation subscriptions across connections.",
  registers: [registry],
});

const chatFanoutEventsTotal = new Counter({
  name: "nyx_chat_fanout_events_total",
  help: "Total chat fanout events processed by source.",
  labelNames: [...fanoutLabelNames],
  registers: [registry],
});

const chatDeliveryReplaysTotal = new Counter({
  name: "nyx_chat_delivery_replays_total",
  help: "Total pending message delivery replays.",
  registers: [registry],
});

const abuseRateLimitedTotal = new Counter({
  name: "nyx_abuse_rate_limited_total",
  help: "Total abuse-control rate limit rejections.",
  labelNames: [...abuseLabelNames],
  registers: [registry],
});

const abuseCooldownsTotal = new Counter({
  name: "nyx_abuse_cooldowns_total",
  help: "Total abuse-control cooldowns created.",
  labelNames: [...abuseLabelNames],
  registers: [registry],
});

const dependencyUp = new Gauge({
  name: "nyx_dependency_up",
  help: "Dependency readiness status where 1 means ready and 0 means not ready.",
  labelNames: [...dependencyLabelNames],
  registers: [registry],
});

const customMetrics = [
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpRequestsInFlight,
  httpErrorsTotal,
  wsConnectionsActive,
  wsConnectionsOpenedTotal,
  wsConnectionsClosedTotal,
  wsMessagesInTotal,
  wsMessagesOutTotal,
  wsMessageRejectionsTotal,
  chatSubscriptionsActive,
  chatFanoutEventsTotal,
  chatDeliveryReplaysTotal,
  abuseRateLimitedTotal,
  abuseCooldownsTotal,
  dependencyUp,
];

const labelsMatch = (
  sampleLabels: Partial<Record<string, string | number>> | undefined,
  expectedLabels: Record<string, string>
) =>
  Object.entries(expectedLabels).every(
    ([key, value]) => String(sampleLabels?.[key]) === value
  );

export const observabilityMetrics = {
  registry,

  async getMetricsPayload() {
    return registry.metrics();
  },

  get contentType() {
    return registry.contentType;
  },

  incrementHttpInFlight(labels: Record<(typeof httpLabelNames)[number], string>) {
    httpRequestsInFlight.inc(labels);
  },

  decrementHttpInFlight(labels: Record<(typeof httpLabelNames)[number], string>) {
    httpRequestsInFlight.dec(labels);
  },

  observeHttpRequest({
    method,
    route,
    statusClass,
    durationMs,
  }: {
    method: string;
    route: string;
    statusClass: string;
    durationMs: number;
  }) {
    const labels = {
      method,
      route,
      status_class: statusClass,
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationMs / 1000);
  },

  incrementHttpError({
    route,
    errorCode,
  }: {
    route: string;
    errorCode: string;
  }) {
    httpErrorsTotal.inc({
      route,
      error_code: errorCode,
    });
  },

  observeWsConnectionOpened() {
    wsConnectionsOpenedTotal.inc();
    wsConnectionsActive.inc();
  },

  observeWsConnectionClosed(code?: number) {
    wsConnectionsClosedTotal.inc({
      code: String(code ?? 1000),
    });
    wsConnectionsActive.dec();
  },

  incrementWsMessageIn(type: string) {
    wsMessagesInTotal.inc({ type });
  },

  incrementWsMessageOut(type: string) {
    wsMessagesOutTotal.inc({ type });
  },

  incrementWsMessageRejection({
    type,
    code,
  }: {
    type: string;
    code: string;
  }) {
    wsMessageRejectionsTotal.inc({ type, code });
  },

  incrementChatSubscriptionsActive() {
    chatSubscriptionsActive.inc();
  },

  decrementChatSubscriptionsActive() {
    chatSubscriptionsActive.dec();
  },

  incrementChatFanout({
    source,
    event,
  }: {
    source: "local" | "remote";
    event: string;
  }) {
    chatFanoutEventsTotal.inc({ source, event });
  },

  incrementChatDeliveryReplays(count = 1) {
    chatDeliveryReplaysTotal.inc(count);
  },

  incrementAbuseRateLimited({
    policy,
    transport,
  }: {
    policy: string;
    transport: "http" | "websocket";
  }) {
    abuseRateLimitedTotal.inc({ policy, transport });
  },

  incrementAbuseCooldown({
    policy,
    transport,
  }: {
    policy: string;
    transport: "http" | "websocket";
  }) {
    abuseCooldownsTotal.inc({ policy, transport });
  },

  setDependencyUp(service: "db" | "redis" | "realtime", isUp: boolean) {
    dependencyUp.set({ service }, isUp ? 1 : 0);
  },

  resetForTests() {
    for (const metric of customMetrics) {
      metric.reset();
    }
  },

  async getMetricValueForTests(
    name: string,
    labels: Record<string, string> = {}
  ) {
    const metrics = await registry.getMetricsAsJSON();
    const metric = metrics.find((entry) => entry.name === name);

    if (!metric) {
      return null;
    }

    const sample = metric.values.find((value) => labelsMatch(value.labels, labels));
    return sample?.value ?? null;
  },
};
