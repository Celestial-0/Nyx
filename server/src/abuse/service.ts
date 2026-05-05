import type { AbuseInvalidFramePolicy, AbuseRateLimitPolicy, AbuseRedis } from "@/abuse/types";
import { observabilityMetrics } from "@/observability";

const tokenBucketScript = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillPerMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'updatedAt')
local tokens = tonumber(data[1])
local updatedAt = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  updatedAt = now
end

local elapsed = math.max(0, now - updatedAt)
tokens = math.min(capacity, tokens + (elapsed * refillPerMs))

local allowed = 0
local retryAfterMs = 0

if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
else
  retryAfterMs = math.ceil((requested - tokens) / refillPerMs)
end

redis.call('HMSET', key, 'tokens', tokens, 'updatedAt', now)

local ttlMs = math.ceil((capacity / refillPerMs) * 2)
if ttlMs < 1000 then
  ttlMs = 1000
end
redis.call('PEXPIRE', key, ttlMs)

return { allowed, retryAfterMs }
`;

const abuseKeys = {
  bucket: (policyKey: string, subject: string) => `abuse:bucket:${policyKey}:${subject}`,
  strikes: (policyKey: string, subject: string) => `abuse:strikes:${policyKey}:${subject}`,
  cooldown: (policyKey: string, subject: string) => `abuse:cooldown:${policyKey}:${subject}`,
};

const validClientFingerprintPattern = /^[A-Za-z0-9:.\-%]{1,128}$/;

const normalizeClientFingerprint = (value?: string | null) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const unwrapped = trimmed.replace(/^"(.*)"$/, "$1");

  return validClientFingerprintPattern.test(unwrapped) ? unwrapped : null;
};

const getCooldownRetryAfterMs = async ({
  redis,
  policyKey,
  subject,
}: {
  redis: AbuseRedis;
  policyKey: string;
  subject: string;
}) => {
  const ttlMs = await redis.pttl(abuseKeys.cooldown(policyKey, subject));
  return ttlMs > 0 ? ttlMs : null;
};

const registerStrike = async ({
  redis,
  policy,
  subject,
}: {
  redis: AbuseRedis;
  policy: AbuseRateLimitPolicy;
  subject: string;
}) => {
  const strikesKey = abuseKeys.strikes(policy.key, subject);
  const strikeCount = await redis.incr(strikesKey);

  if (strikeCount === 1) {
    await redis.expire(strikesKey, policy.strikeWindowSeconds);
  }

    if (strikeCount < policy.strikeThreshold) {
      return null;
    }

    await redis.set(
    abuseKeys.cooldown(policy.key, subject),
    "1",
    "EX",
      policy.cooldownSeconds
    );

  observabilityMetrics.incrementAbuseCooldown({
    policy: policy.key,
    transport: policy.transport,
  });

  return policy.cooldownSeconds * 1000;
};

export const abuseService = {
  keys: abuseKeys,

  getClientFingerprintFromHeaders: (headers: Headers) => {
    const forwardedFor = headers.get("x-forwarded-for");

    if (forwardedFor) {
      const firstIp = forwardedFor
        .split(",")
        .map((part) => part.trim())
        .map((part) => normalizeClientFingerprint(part))
        .find(Boolean);

      if (firstIp) {
        return firstIp;
      }
    }

    return (
      normalizeClientFingerprint(headers.get("cf-connecting-ip")) ??
      normalizeClientFingerprint(headers.get("x-real-ip")) ??
      "unknown"
    );
  },

  createUserSubject: (userId: string) => `user:${userId}`,
  createClientSubject: (fingerprint: string) => `client:${fingerprint}`,
  createWalletClientSubject: (fingerprint: string, walletAddress: string) =>
    `client:${fingerprint}:wallet:${walletAddress}`,
  createSessionSubject: (sessionId: string) => `session:${sessionId}`,

  getCooldownRetryAfterMs,

  consumePolicy: async ({
    redis,
    policy,
    subject,
  }: {
    redis: AbuseRedis;
    policy: AbuseRateLimitPolicy;
    subject: string;
  }) => {
    const cooldownRetryAfterMs = await getCooldownRetryAfterMs({
      redis,
      policyKey: policy.key,
      subject,
    });

    if (cooldownRetryAfterMs !== null) {
      observabilityMetrics.incrementAbuseRateLimited({
        policy: policy.key,
        transport: policy.transport,
      });

      return {
        allowed: false,
        retryAfterMs: cooldownRetryAfterMs,
        scope: policy.scope,
        reason: "cooldown" as const,
      };
    }

    const [allowed, retryAfterMs] = (await redis.eval(
      tokenBucketScript,
      1,
      abuseKeys.bucket(policy.key, subject),
      policy.capacity,
      policy.refillPerSecond / 1000,
      Date.now(),
      1
    )) as [number, number];

    if (Number(allowed) === 1) {
      return {
        allowed: true,
        retryAfterMs: null,
        scope: policy.scope,
        reason: "bucket" as const,
      };
    }

    const strikeCooldownMs = await registerStrike({
      redis,
      policy,
      subject,
    });

    observabilityMetrics.incrementAbuseRateLimited({
      policy: policy.key,
      transport: policy.transport,
    });

    return {
      allowed: false,
      retryAfterMs:
        strikeCooldownMs !== null
          ? Math.max(Number(retryAfterMs) || 0, strikeCooldownMs)
          : Number(retryAfterMs) > 0
            ? Number(retryAfterMs)
            : null,
      scope: policy.scope,
      reason: strikeCooldownMs !== null ? ("cooldown" as const) : ("bucket" as const),
    };
  },

  recordInvalidFrame: async ({
    redis,
    policy,
    subject,
  }: {
    redis: AbuseRedis;
    policy: AbuseInvalidFramePolicy;
    subject: string;
  }) => {
    const cooldownRetryAfterMs = await getCooldownRetryAfterMs({
      redis,
      policyKey: policy.key,
      subject,
    });

    if (cooldownRetryAfterMs !== null) {
      return {
        count: policy.threshold,
        shouldClose: true,
        retryAfterMs: cooldownRetryAfterMs,
        scope: policy.scope,
      };
    }

    const strikesKey = abuseKeys.strikes(policy.key, subject);
    const count = await redis.incr(strikesKey);

    if (count === 1) {
      await redis.expire(strikesKey, policy.windowSeconds);
    }

    if (count < policy.threshold) {
      return {
        count,
        shouldClose: false,
        retryAfterMs: null,
        scope: policy.scope,
      };
    }

    await redis.set(
      abuseKeys.cooldown(policy.key, subject),
      "1",
      "EX",
      policy.cooldownSeconds
    );

    observabilityMetrics.incrementAbuseCooldown({
      policy: policy.key,
      transport: policy.transport,
    });

    return {
      count,
      shouldClose: true,
      retryAfterMs: policy.cooldownSeconds * 1000,
      scope: policy.scope,
    };
  },
};
