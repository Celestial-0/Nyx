import { apiRequest } from "@/lib/api"

import type { UpdateProfileRequest } from "@/features/auth/auth.types"

import type { UserDirectoryEntry, UserProfile } from "./user.types"

export async function getMyProfile(accessToken: string): Promise<UserProfile> {
  if (!accessToken) {
    throw new Error("Not authenticated")
  }

  return apiRequest<UserProfile>("/users/me", {
    method: "GET",
    accessToken,
  })
}

export async function updateProfile(
  patch: UpdateProfileRequest,
  accessToken: string
): Promise<UserProfile> {
  if (!accessToken) {
    throw new Error("Not authenticated")
  }

  return apiRequest<UserProfile>("/users/me", {
    method: "PATCH",
    accessToken,
    body: patch,
  })
}

export async function searchUsers(
  query: string,
  accessToken: string
): Promise<UserDirectoryEntry[]> {
  if (!accessToken) {
    throw new Error("Not authenticated")
  }

  const searchParams = new URLSearchParams({
    q: query,
  })
  return apiRequest<UserDirectoryEntry[]>(`/users/search?${searchParams}`, {
    method: "GET",
    accessToken,
  })
}

export async function lookupUser(input: {
  by: "username" | "wallet"
  value: string
  accessToken: string
}): Promise<UserDirectoryEntry> {
  if (!input.accessToken) {
    throw new Error("Not authenticated")
  }

  const searchParams = new URLSearchParams({
    by: input.by,
    value: input.value,
  })
  return apiRequest<UserDirectoryEntry>(`/users/lookup?${searchParams}`, {
    method: "GET",
    accessToken: input.accessToken,
  })
}
