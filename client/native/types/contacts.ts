import { z } from 'zod';

import { IsoDateStringSchema } from './common';
import { UserProfileSchema } from './user';

/** Contact list schemas. Ported from web `features/contacts`. */

export const ContactEntrySchema = z.object({
  user: UserProfileSchema,
  alias: z.string().nullable(),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
});

export const ContactsListResponseSchema = z.object({
  contacts: z.array(ContactEntrySchema),
});

export const SaveContactInputSchema = z.object({
  contactUserId: z.string(),
  alias: z.string().nullable().optional(),
});

export const RemoveContactResponseSchema = z.object({
  removed: z.literal(true),
  contactUserId: z.string(),
});

export type ContactEntry = z.infer<typeof ContactEntrySchema>;
export type ContactsListResponse = z.infer<typeof ContactsListResponseSchema>;
export type SaveContactInput = z.infer<typeof SaveContactInputSchema>;
export type RemoveContactResponse = z.infer<typeof RemoveContactResponseSchema>;
