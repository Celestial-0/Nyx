import { z } from "@hono/zod-openapi";

export const healthServiceStatusSchema = z.enum(["ok", "error"]);
export const healthOverallStatusSchema = z.enum(["ok", "partial", "degraded"]);

export const healthDataSchema = z.object({
  status: healthOverallStatusSchema,
  services: z.object({
    db: healthServiceStatusSchema,
    redis: healthServiceStatusSchema,
    realtime: healthServiceStatusSchema,
  }),
  time: z.string(),
  uptimeSeconds: z.number().int().nonnegative(),
});

export const healthSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: healthDataSchema,
  })
  .openapi("HealthSuccessResponse");
