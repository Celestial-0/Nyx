import { Elysia } from "elysia";
import { healthRoutes } from "@/modules/health/health.route";

export const healthModule = new Elysia().use(healthRoutes);