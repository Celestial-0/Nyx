import { randomUUID } from "node:crypto";

const validRequestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const uuidSegmentPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const numericSegmentPattern = /^\d+$/;
const opaqueSegmentPattern = /^[A-Za-z0-9_-]{16,}$/;

export const observabilityRequest = {
  resolveRequestId(headers: Headers) {
    const incoming = headers.get("x-request-id")?.trim();

    if (incoming && validRequestIdPattern.test(incoming)) {
      return incoming;
    }

    return randomUUID();
  },

  normalizeRouteLabel(path: string) {
    if (!path || path === "/") {
      return "/";
    }

    const normalized = path
      .split("/")
      .map((segment, index) => {
        if (index === 0 || segment.length === 0) {
          return segment;
        }

        if (uuidSegmentPattern.test(segment) || numericSegmentPattern.test(segment)) {
          return ":id";
        }

        if (opaqueSegmentPattern.test(segment)) {
          return ":param";
        }

        return segment;
      })
      .join("/");

    return normalized || "/";
  },

  getStatusClass(statusCode: number) {
    const group = Math.max(1, Math.min(5, Math.floor(statusCode / 100) || 5));
    return `${group}xx`;
  },
};
