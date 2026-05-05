import { z } from "@hono/zod-openapi";
import { usersProfileSchema } from "@/features/users/schema";

export const contactParamsSchema = z
  .object({
    contactUserId: z.string().uuid(),
  })
  .strict();

export const createContactBodySchema = z
  .object({
    contactUserId: z.string().uuid(),
    alias: z.string().trim().min(1).max(80).nullable().optional(),
  })
  .strict();

export const updateContactBodySchema = z
  .object({
    alias: z.string().trim().min(1).max(80).nullable(),
  })
  .strict();

export const contactEntrySchema = z
  .object({
    user: usersProfileSchema,
    alias: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("ContactEntry");

export const contactsListSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      contacts: z.array(contactEntrySchema),
    }),
  })
  .openapi("ContactsListSuccessResponse");

export const contactEntrySuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: contactEntrySchema,
  })
  .openapi("ContactEntrySuccessResponse");

export const contactDeleteSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      removed: z.literal(true),
      contactUserId: z.string().uuid(),
    }),
  })
  .openapi("ContactDeleteSuccessResponse");
