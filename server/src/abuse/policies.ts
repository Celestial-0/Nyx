import { env } from "@/config/env";
import type { AbuseInvalidFramePolicy, AbuseRateLimitPolicy } from "@/abuse/types";

const createRateLimitPolicy = (
  policy: Omit<AbuseRateLimitPolicy, "strikeThreshold" | "strikeWindowSeconds" | "cooldownSeconds">
): AbuseRateLimitPolicy => ({
  ...policy,
  strikeThreshold: 3,
  strikeWindowSeconds: 60 * 10,
  cooldownSeconds: 60 * 15,
});

export const abusePolicies = {
  chatMessageSend: createRateLimitPolicy({
    key: "chat.message.send",
    scope: "chat.message.send",
    transport: "websocket",
    capacity: env.REALTIME_RATE_LIMIT_CAPACITY,
    refillPerSecond: env.REALTIME_RATE_LIMIT_REFILL_PER_SECOND,
  }),
  chatSubscriptionOps: createRateLimitPolicy({
    key: "chat.subscription.ops",
    scope: "chat.subscription.ops",
    transport: "websocket",
    capacity: 30,
    refillPerSecond: 0.5,
  }),
  roomsCreate: createRateLimitPolicy({
    key: "rooms.create",
    scope: "rooms.create",
    transport: "http",
    capacity: 3,
    refillPerSecond: 1 / (20 * 60),
  }),
  paymentsRechargeVerify: createRateLimitPolicy({
    key: "payments.recharge.verify",
    scope: "payments.recharge.verify",
    transport: "http",
    capacity: 5,
    refillPerSecond: 1 / (2 * 60),
  }),
  authNonce: createRateLimitPolicy({
    key: "auth.nonce",
    scope: "auth.nonce",
    transport: "http",
    capacity: 5,
    refillPerSecond: 1 / 60,
  }),
  authVerify: createRateLimitPolicy({
    key: "auth.verify",
    scope: "auth.verify",
    transport: "http",
    capacity: 10,
    refillPerSecond: 1 / 60,
  }),
  usersDiscovery: createRateLimitPolicy({
    key: "users.discovery",
    scope: "users.discovery",
    transport: "http",
    capacity: 30,
    refillPerSecond: 0.5,
  }),
} as const;

export const abuseInvalidFramePolicy: AbuseInvalidFramePolicy = {
  key: "chat.websocket.invalid_frames",
  scope: "chat.websocket.invalid_frames",
  transport: "websocket",
  threshold: 10,
  windowSeconds: 60,
  cooldownSeconds: 60 * 5,
};
