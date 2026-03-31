/**
 * useProfile
 * 
 * Hook for profile operations
 * Handles: load profile, update profile
 * 
 * Usage:
 *   const { profile, isLoading, loadProfile, updateProfile } = useProfile();
 */

import { useCallback } from "react";
import { useUserStore } from "@/store/user.store";
import { useAuth } from "@/context/auth.context";
import type { UpdateProfileRequest } from "@/api/auth/types";

export function useProfile() {
  const profile = useUserStore((state) => state.profile);
  const isLoading = useUserStore((state) => state.isLoading);
  const error = useUserStore((state) => state.error);
  const setError = useUserStore((state) => state.setError);

  const { loadProfile: ctxLoadProfile, completeProfile: ctxUpdateProfile } =
    useAuth();

  /**
   * Load user profile
   */
  const loadProfile = useCallback(async () => {
    try {
      setError(null);
      await ctxLoadProfile();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load profile";
      setError(message);
      throw err;
    }
  }, [ctxLoadProfile, setError]);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(
    async (patch: UpdateProfileRequest) => {
      try {
        setError(null);
        await ctxUpdateProfile(patch);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update profile";
        setError(message);
        throw err;
      }
    },
    [ctxUpdateProfile, setError]
  );

  return {
    // State
    profile,
    isLoading,
    error,

    // Actions
    loadProfile,
    updateProfile,
  };
}
