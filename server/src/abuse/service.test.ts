import { afterEach, describe, expect, test } from "bun:test";
import { abuseService } from "@/abuse/service";
import { observabilityMetrics } from "@/observability";
import { redis } from "@/platform/redis/client";

const cleanupAbuseKeys = async () => {
  const keys = await redis.keys("abuse:*");

  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

afterEach(async () => {
  observabilityMetrics.resetForTests();
  await cleanupAbuseKeys();
});

describe("abuseService", () => {
  test("repeated rate-limit breaches escalate into cooldowns and then expire", async () => {
    const subject = "user:test-abuse";
    const policy = {
      key: "test.policy",
      scope: "test.policy",
      transport: "http",
      capacity: 1,
      refillPerSecond: 0.000001,
      strikeThreshold: 3,
      strikeWindowSeconds: 60,
      cooldownSeconds: 1,
    } as const;

    const firstAllowed = await abuseService.consumePolicy({
      redis,
      policy,
      subject,
    });
    expect(firstAllowed.allowed).toBe(true);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const blocked = await abuseService.consumePolicy({
        redis,
        policy,
        subject,
      });

      expect(blocked.allowed).toBe(false);
    }

    const cooldownRetryAfterMs = await abuseService.getCooldownRetryAfterMs({
      redis,
      policyKey: policy.key,
      subject,
    });
    expect(cooldownRetryAfterMs).toBeGreaterThan(0);

    let afterCooldown =
      await abuseService.getCooldownRetryAfterMs({
        redis,
        policyKey: policy.key,
        subject,
      });

    const startedAt = Date.now();
    while (afterCooldown !== null && Date.now() - startedAt < 2_000) {
      await Bun.sleep(50);
      afterCooldown = await abuseService.getCooldownRetryAfterMs({
        redis,
        policyKey: policy.key,
        subject,
      });
    }

    expect(afterCooldown).toBeNull();

    expect(
      await observabilityMetrics.getMetricValueForTests(
        "nyx_abuse_rate_limited_total",
        {
          policy: policy.key,
          transport: policy.transport,
        }
      )
    ).toBe(3);
    expect(
      await observabilityMetrics.getMetricValueForTests(
        "nyx_abuse_cooldowns_total",
        {
          policy: policy.key,
          transport: policy.transport,
        }
      )
    ).toBe(1);
  });
});
