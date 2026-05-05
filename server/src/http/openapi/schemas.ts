import { z } from "@hono/zod-openapi";

export const errorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  })
  .openapi("ErrorResponse");
