import { Elysia } from "elysia";
import { healthRoute } from "@/modules/health/health.route";

export const healthModule = new Elysia().use(healthRoute);