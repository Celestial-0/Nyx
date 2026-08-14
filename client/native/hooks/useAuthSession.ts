import {
  TOKEN_REFRESH_SKEW_MS,
  bootstrapAuthSession,
  logoutAuthSession,
  refreshAuthSession,
  saveCurrentUserProfile,
  verifyWalletSignIn,
} from '@/lib/auth';
import { useAuthStore } from '@/store/auth.store';
import { useUserStore } from '@/store/user.store';
import type { UpdateProfileRequest, VerifyRequest } from '@/types';
import { useCallback, useEffect } from 'react';

/**
 * Bootstraps the auth session once the persisted store has hydrated, keeps the
 * access token fresh, and exposes derived session flags. Mirrors the web
 * client's `useAuthSession` (`features/auth/auth.hooks.ts`).
 */
export function useAuthSession() {
  const status = useAuthStore((state) => state.status);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const accessTokenExpiresAt = useAuthStore((state) => state.accessTokenExpiresAt);

  useEffect(() => {
    if (isHydrated && status === 'idle') {
      void bootstrapAuthSession();
    }
  }, [isHydrated, status]);

  useEffect(() => {
    if (status !== 'authenticated' || !accessTokenExpiresAt) {
      return;
    }

    const refreshIn = Math.max(
      5_000,
      accessTokenExpiresAt - Date.now() - TOKEN_REFRESH_SKEW_MS
    );
    const timeoutId = setTimeout(() => {
      void refreshAuthSession();
    }, refreshIn);

    return () => clearTimeout(timeoutId);
  }, [accessTokenExpiresAt, status]);

  return {
    status,
    isHydrated,
    isLoading,
    isAuthenticated: status === 'authenticated',
    isUnauthenticated: status === 'unauthenticated',
  };
}

/** Wallet sign-in + profile setup helpers. */
export function useWalletAuth() {
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const profile = useUserStore((state) => state.profile);
  const setError = useAuthStore((state) => state.setError);

  const signIn = useCallback(
    (payload: VerifyRequest) => {
      setError(null);
      return verifyWalletSignIn(payload);
    },
    [setError]
  );

  const saveProfile = useCallback(
    (patch: UpdateProfileRequest) => saveCurrentUserProfile(patch),
    []
  );

  return { isVerifying: isLoading, error, profile, signIn, saveProfile };
}

/** Sign the user out and clear all session-scoped stores. */
export function useLogout() {
  const isLoading = useAuthStore((state) => state.isLoading);

  const logout = useCallback(async () => {
    try {
      await logoutAuthSession();
    } catch (error) {
      console.error('Logout error (session cleared):', error);
    }
  }, []);

  return { isLoading, logout };
}
