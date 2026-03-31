import { Elysia } from "elysia";
import { healthHandler } from "@/modules/health/health.handler";

export const healthModule = new Elysia({
    name: "health.module",
}).use(healthHandler);