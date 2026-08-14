import { useCallback } from 'react';

import { loadCurrentUserProfile, saveCurrentUserProfile } from '@/lib/auth';
import { useAuthStore } from '@/store/auth.store';
import { useUserStore } from '@/store/user.store';
import type { UpdateProfileRequest } from '@/types';

/** Current user profile + config helpers. Ported from web `user.hooks.ts`. */

export function useCurrentUser() {
  return useUserStore((state) => state.profile);
}

export function useUserConfig() {
  return useUserStore((state) => state.config);
}

export function useProfile() {
  const profile = useUserStore((state) => state.profile);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const setError = useAuthStore((state) => state.setError);

  const loadProfile = useCallback(async () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new Error('Not authenticated');
    }
    try {
      setError(null);
      return await loadCurrentUserProfile(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      throw err;
    }
  }, [setError]);

  const updateProfile = useCallback(
    async (patch: UpdateProfileRequest) => {
      try {
        setError(null);
        return await saveCurrentUserProfile(patch);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update profile');
        throw err;
      }
    },
    [setError]
  );

  return { profile, isLoading, error, loadProfile, updateProfile };
}
