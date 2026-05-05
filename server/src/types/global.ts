import type { db } from "@/platform/db/client";
import type { eventBus } from "@/platform/events";
import type { jwtService } from "@/security/jwt";
import type { redis } from "@/platform/redis/client";
import type { AuthenticatedUser } from "@/features/auth/types";

export type AppBindings = {
  Variables: {
    db: typeof db;
    redis: typeof redis;
    jwt: typeof jwtService;
    eventBus: typeof eventBus;
    authUser: AuthenticatedUser | null;
    requestId: string;
    requestErrorCode: string | null;
  };
};
