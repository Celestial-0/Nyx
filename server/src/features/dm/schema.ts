import { z } from "@hono/zod-openapi";
import { solanaAddressSchema } from "@/features/auth/schema";
import { e2eePeerDeviceBundleSchema } from "@/features/e2ee/schema";
import { roomSummarySchema } from "@/features/rooms/schema";

export const dmStartBodySchema = z
  .object({
    username: z.string().min(3).max(30).optional(),
    walletAddress: solanaAddressSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const present = [data.username, data.walletAddress].filter(Boolean);

    if (present.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one of username or walletAddress.",
        path: ["username"],
      });
    }
  });

export const dmStartSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      conversation: roomSummarySchema,
      created: z.boolean(),
      peerUserId: z.string().uuid(),
      peerDeviceBundles: z.array(e2eePeerDeviceBundleSchema),
    }),
  })
  .openapi("DmStartSuccessResponse");
