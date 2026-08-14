import {
  ContactEntrySchema,
  ContactsListResponseSchema,
  RemoveContactResponseSchema,
  type SaveContactInput,
} from '@/types';

import { apiRequest } from './client';

export async function listContacts(accessToken: string) {
  return ContactsListResponseSchema.parse(
    await apiRequest('/contacts', { method: 'GET', accessToken })
  );
}

export async function saveContact(input: SaveContactInput, accessToken: string) {
  return ContactEntrySchema.parse(
    await apiRequest('/contacts', { method: 'POST', accessToken, body: input })
  );
}

export async function updateContactAlias(
  contactUserId: string,
  alias: string | null,
  accessToken: string
) {
  return ContactEntrySchema.parse(
    await apiRequest(`/contacts/${contactUserId}`, {
      method: 'PATCH',
      accessToken,
      body: { alias },
    })
  );
}

export async function removeContact(contactUserId: string, accessToken: string) {
  return RemoveContactResponseSchema.parse(
    await apiRequest(`/contacts/${contactUserId}`, { method: 'DELETE', accessToken })
  );
}
