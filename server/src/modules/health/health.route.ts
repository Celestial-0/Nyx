import { Elysia } from "elysia";

import { healthSuccessResponseSchema } from "@/modules/health/health.schema";
import { healthService } from "@/modules/health/health.service";
import { coreInfraPlugin } from "@/plugins/core-infra.plugin";
import { success } from "@/utils/response";

export const healthRoute = new Elysia({
    name: "health.route",
}).use(coreInfraPlugin)
.get("/health",async ({ db, redis }) => {
    const data = await healthService(db, redis);
    return success(data);
}, {
    detail: {
        tags: ["Health"],
        summary: "Health check",
        description: "Checks API dependencies like Postgres and Redis.",
    },
    response: {
        200: healthSuccessResponseSchema,
    },
});