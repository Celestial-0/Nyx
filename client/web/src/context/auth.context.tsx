/**
 * Auth Context & Provider
 * 
 * Orchestrates auth flow:
 * 1. API calls (pure, no side-effects)
 * 2. Store mutations (state updates)
 * 3. Error handling
 * 
 * Store remains source-of-truth for state.
 * Context is orchestration facade only (no state duplication).
 */

import React, { createContext, useContext, useCallback, useEffect } from "react";
import { useUserStore } from "@/store/user.store";
import {
  verifySignature,
  getMyProfile,
  updateProfile,
  refreshAccessToken,
} from "@/lib/api/auth";
import { getAccessToken, getRefreshToken, setAccessToken, clearTokens } from "@/api/auth/tokens";
import type {
  VerifyRequest,
  UpdateProfileRequest,
} from "@/api/auth/types";

type AuthContextValue = {
  // State (from store)
  status: "idle" | "authenticated" | "unauthenticated";
  profile: any | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  bootstrapSession: () => Promise<void>;
  verifyAndSignIn: (payload: VerifyRequest) => Promise<void>;
  completeProfile: (patch: UpdateProfileRequest) => Promise<void>;
  loadProfile: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const status = useUserStore((state) => state.status);
  const profile = useUserStore((state) => state.profile);
  const isLoading = useUserStore((state) => state.isLoading);
  const error = useUserStore((state) => state.error);
  const accessToken = useUserStore((state) => state.accessToken);
  const refreshToken = useUserStore((state) => state.refreshToken);

  const setLoading = useUserStore((state) => state.setLoading);
  const setError = useUserStore((state) => state.setError);
  const setStatus = useUserStore((state) => state.setStatus);
  const setAuthFromVerify = useUserStore((state) => state.setAuthFromVerify);
  const setProfile = useUserStore((state) => state.setProfile);
  const clearError = useUserStore((state) => state.clearError);
  const logout = useUserStore((state) => state.logout);

  /**
   * Bootstrap session on mount
   * Check if tokens exist in localStorage; if so, validate and load profile
   */
  const bootstrapSession = useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      setStatus("unauthenticated");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Token exists; try to load profile
      const userProfile = await getMyProfile(token);
      setStatus("authenticated");
      // Note: accessToken already in store from persistence
      setProfile(userProfile);
      setLoading(false);
    } catch (err) {
      // Token invalid; try to refresh
      const refreshed = await refreshSession();
      if (!refreshed) {
        setLoading(false);
        return;
      }

      // After refresh, load profile again
      await loadProfile();
    }
  }, [setLoading, setError, setStatus, setProfile]);

  /**
   * Verify wallet signature and sign in
   * Called after wallet signs the message
   */
  const verifyAndSignIn = useCallback(
    async (payload: VerifyRequest) => {
      setLoading(true);
      setError(null);

      try {
        const verified = await verifySignature(payload);
        setAuthFromVerify(verified);
        setLoading(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Verification failed";
        setError(message);
        setLoading(false);
        throw err;
      }
    },
    [setLoading, setError, setAuthFromVerify]
  );

  /**
   * Complete user profile after first sign-in
   */
  const completeProfile = useCallback(
    async (patch: UpdateProfileRequest) => {
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      setLoading(true);
      setError(null);

      try {
        const updated = await updateProfile(patch, accessToken);
        setProfile(updated);
        setLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Update failed";
        setError(message);
        setLoading(false);
        throw err;
      }
    },
    [accessToken, setLoading, setError, setProfile]
  );

  /**
   * Load current user profile
   * Used after sign-in or when profile needed
   */
  const loadProfile = useCallback(async () => {
    const token = accessToken || getAccessToken();

    if (!token) {
      setStatus("unauthenticated");
      setError("Not authenticated");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userProfile = await getMyProfile(token);
      setProfile(userProfile);
      setStatus("authenticated");
      setLoading(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load profile";
      setError(message);
      setLoading(false);
      throw err;
    }
  }, [accessToken, setLoading, setError, setStatus, setProfile]);

  /**
   * Refresh access token using refresh token
   * Returns true if successful, false if refresh failed (user logged out)
   */
  const refreshSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = refreshToken || getRefreshToken();
      if (!token) {
        throw new Error("No refresh token");
      }

      const response = await refreshAccessToken(token);
      // RefreshResponse only has accessToken; store it and keep refreshToken
      setAccessToken(response.accessToken);
      const updateState = useUserStore.getState();
      updateState.setAccessToken(response.accessToken);
      setLoading(false);
      return true;
    } catch (err) {
      clearTokens();
      setStatus("unauthenticated");
      setProfile(null);
      const message =
        err instanceof Error ? err.message : "Session refresh failed";
      setError(message);
      setLoading(false);
      return false;
    }
  }, [refreshToken, setLoading, setError, setStatus, setProfile]);

  /**
   * Initialize bootstrap on mount
   */
  useEffect(() => {
    void bootstrapSession();
  }, []);

  const value: AuthContextValue = {
    status,
    profile,
    isLoading,
    error,
    bootstrapSession,
    verifyAndSignIn,
    completeProfile,
    loadProfile,
    refreshSession,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to consume auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
