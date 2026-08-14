import {
  type UpdateProfileRequest,
  type UserDirectoryEntry,
  UserDirectoryEntrySchema,
  type UserProfile,
  UserProfileSchema,
} from '@/types';
import { z } from 'zod';

import { apiRequest } from './client';

export async function getMyProfile(accessToken: string): Promise<UserProfile> {
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  return UserProfileSchema.parse(await apiRequest('/users/me', { method: 'GET', accessToken }));
}

export async function updateProfile(
  patch: UpdateProfileRequest,
  accessToken: string
): Promise<UserProfile> {
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  return UserProfileSchema.parse(
    await apiRequest('/users/me', { method: 'PATCH', accessToken, body: patch })
  );
}

export async function searchUsers(
  query: string,
  accessToken: string
): Promise<UserDirectoryEntry[]> {
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const searchParams = new URLSearchParams({ q: query });
  return z
    .array(UserDirectoryEntrySchema)
    .parse(await apiRequest(`/users/search?${searchParams}`, { method: 'GET', accessToken }));
}

export async function lookupUser(input: {
  by: 'username' | 'wallet';
  value: string;
  accessToken: string;
}): Promise<UserDirectoryEntry> {
  if (!input.accessToken) {
    throw new Error('Not authenticated');
  }

  const searchParams = new URLSearchParams({ by: input.by, value: input.value });
  return UserDirectoryEntrySchema.parse(
    await apiRequest(`/users/lookup?${searchParams}`, {
      method: 'GET',
      accessToken: input.accessToken,
    })
  );
}
