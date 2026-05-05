import type { z } from "zod";
import type { db } from "@/platform/db/client";
import type {
  contactParamsSchema,
  createContactBodySchema,
  updateContactBodySchema,
} from "@/features/contacts/schema";

export type ContactsDb = typeof db;

export type CreateContactInput = z.infer<typeof createContactBodySchema>;
export type UpdateContactInput = z.infer<typeof updateContactBodySchema>;
export type ContactParams = z.infer<typeof contactParamsSchema>;
