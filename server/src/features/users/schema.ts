import { z } from "@hono/zod-openapi";

const walletAddressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const usersUpdateMeBodySchema = z
  .object({
    username: z.string().min(3).max(30).optional(),
    fullName: z.string().min(2).max(60).optional(),
  })
  .strict();

export const usersSearchQuerySchema = z
  .object({
    q: z.string().min(2).max(50),
  })
  .strict();

export const usersLookupQuerySchema = z
  .object({
    by: z.enum(["username", "wallet"]),
    value: z.string().min(1).max(100),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.by === "wallet" && !walletAddressPattern.test(data.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Invalid wallet address.",
      });
    }
  });

export const usersProfileSchema = z
  .object({
    id: z.string().uuid(),
    walletAddress: z.string(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
    role: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("UsersProfile");

export const usersProfileSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: usersProfileSchema,
  })
  .openapi("UsersProfileSuccessResponse");

export const usersSearchSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(usersProfileSchema),
  })
  .openapi("UsersSearchSuccessResponse");
