import { apiRequest } from "@/lib/api"
import type { ContactsListResponse, ContactEntry } from "./contacts.types"

export function listContacts(accessToken: string) {
  return apiRequest<ContactsListResponse>("/contacts", {
    method: "GET",
    accessToken,
  })
}

export function saveContact(
  input: { contactUserId: string; alias?: string | null },
  accessToken: string
) {
  return apiRequest<ContactEntry>("/contacts", {
    method: "POST",
    accessToken,
    body: input,
  })
}

export function updateContactAlias(
  contactUserId: string,
  alias: string | null,
  accessToken: string
) {
  return apiRequest<ContactEntry>(`/contacts/${contactUserId}`, {
    method: "PATCH",
    accessToken,
    body: { alias },
  })
}

export function removeContact(contactUserId: string, accessToken: string) {
  return apiRequest<{ removed: true; contactUserId: string }>(
    `/contacts/${contactUserId}`,
    {
      method: "DELETE",
      accessToken,
    }
  )
}
