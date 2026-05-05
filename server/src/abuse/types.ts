import type { redis } from "@/platform/redis/client";

export type AbuseRedis = typeof redis;

export type AbuseRateLimitPolicy = {
  key: string;
  scope: string;
  transport: "http" | "websocket";
  capacity: number;
  refillPerSecond: number;
  strikeThreshold: number;
  strikeWindowSeconds: number;
  cooldownSeconds: number;
};

export type AbuseInvalidFramePolicy = {
  key: string;
  scope: string;
  transport: "websocket";
  threshold: number;
  windowSeconds: number;
  cooldownSeconds: number;
};

export type AbuseConsumeResult = {
  allowed: boolean;
  retryAfterMs: number | null;
  scope: string;
  reason: "bucket" | "cooldown";
};

export type AbuseInvalidFrameResult = {
  count: number;
  shouldClose: boolean;
  retryAfterMs: number | null;
  scope: string;
};
