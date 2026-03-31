/**
 * useRefresh
 * 
 * Hook for token refresh
 * Handles: refresh access token using refresh token
 * 
 * Usage:
 *   const { refreshSession, isLoading } = useRefresh();
 *   if (!await refreshSession()) {
 *     // Token refresh failed; user is logged out
 *   }
 */

import { useCallback } from "react";
import { useUserStore } from "@/store/user.store";
import { useAuth } from "@/context/auth.context";

export function useRefresh() {
  const isLoading = useUserStore((state) => state.isLoading);
  const { refreshSession } = useAuth();

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      return await refreshSession();
    } catch (err) {
      console.error("Token refresh failed:", err);
      return false;
    }
  }, [refreshSession]);

  return {
    // State
    isLoading,

    // Actions
    refresh,
    refreshSession: refresh, // Alias for clarity
  };
}
