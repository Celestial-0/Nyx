import { afterEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { app } from "@/app";
import { observabilityMetrics } from "@/observability";

afterEach(() => {
  observabilityMetrics.resetForTests();
});

describe("app observability", () => {
  test("responses preserve an inbound x-request-id", async () => {
    const response = await app.request("/metrics", {
      headers: {
        "x-request-id": "phase13-metrics-request",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("phase13-metrics-request");
  });

  test("responses generate an x-request-id when none is provided", async () => {
    const response = await app.request("/metrics");
    const requestId = response.headers.get("x-request-id");

    expect(response.status).toBe(200);
    expect(requestId).toBeString();
    expect(requestId?.length).toBeGreaterThan(0);
  });

  test("invalid inbound x-request-id values are replaced", async () => {
    const invalidRequestId = `${"bad id ".repeat(30)}!`;
    const response = await app.request("/metrics", {
      headers: {
        "x-request-id": invalidRequestId,
      },
    });
    const requestId = response.headers.get("x-request-id");

    expect(response.status).toBe(200);
    expect(requestId).toBeString();
    expect(requestId).not.toBe(invalidRequestId);
    expect(requestId?.length).toBeGreaterThan(0);
  });

  test("GET /metrics returns Prometheus text with key observability metrics", async () => {
    await app.request("/health", {
      headers: {
        "x-request-id": "metrics-health",
      },
    });

    const response = await app.request("/metrics");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    expect(body).toContain("nyx_http_requests_total");
    expect(body).toContain("nyx_ws_connections_active");
    expect(body).toContain('nyx_dependency_up{service="db"}');
    expect(body).toContain("nyx_process_cpu_user_seconds_total");
  });

  test("request metrics use normalized route labels instead of raw ids", async () => {
    const conversationId = randomUUID();
    await app.request(`/chat/conversations/${conversationId}/messages?limit=1`);

    const metricsResponse = await app.request("/metrics");
    const metricsBody = await metricsResponse.text();

    expect(metricsBody).toContain('route="/chat/conversations/:id/messages"');
    expect(metricsBody).not.toContain(conversationId);
  });

  test("HTTP error paths increment nyx_http_errors_total", async () => {
    await app.request("/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "group" }),
    });

    const metricsBody = await (await app.request("/metrics")).text();

    expect(metricsBody).toContain('nyx_http_errors_total{route="/rooms",error_code="UNAUTHORIZED"} 1');
  });
});
