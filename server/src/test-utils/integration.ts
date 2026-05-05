import { db } from "@/platform/db/client";
import { redis } from "@/platform/redis/client";

const rollbackMarker = { rollback: true } as const;

export type TestDb = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const withTestTransaction = async <T>(fn: (tx: TestDb) => Promise<T>) => {
  let result!: T;

  try {
    await db.transaction(async (tx) => {
      result = await fn(tx);
      throw rollbackMarker;
    });
  } catch (error) {
    if (error !== rollbackMarker) {
      throw error;
    }
  }

  return result;
};

export const cleanupChatRedisState = async ({
  sessionId,
  conversationIds,
}: {
  sessionId: string;
  conversationIds: string[];
}) => {
  const patterns = ["ws:*", "realtime:*", "ratelimit:*", "abuse:*"];
  const keySets = await Promise.all(patterns.map((pattern) => redis.keys(pattern)));
  const keys = [...new Set(keySets.flat())];

  if (keys.length > 0) {
    await redis.del(...keys);
  }
};
