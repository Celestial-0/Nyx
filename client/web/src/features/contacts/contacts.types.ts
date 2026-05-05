import type { UserProfile } from "@/features/user/user.types"

export type ContactEntry = {
  user: UserProfile
  alias: string | null
  createdAt: string
  updatedAt: string
}

export type ContactsListResponse = {
  contacts: ContactEntry[]
}
