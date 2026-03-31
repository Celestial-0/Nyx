/**
 * useLogout
 * 
 * Hook for sign-out
 * Handles: clear tokens, reset store, notify context
 * 
 * Usage:
 *   const { logout, isLoading } = useLogout();
 *   await logout();
 */

import { useCallback } from "react";
import { useUserStore } from "@/store/user.store";
import { useAuth } from "@/context/auth.context";

export function useLogout() {
  const isLoading = useUserStore((state) => state.isLoading);
  const { logout: ctxLogout } = useAuth();

  const logout = useCallback(async () => {
    try {
      await ctxLogout();
    } catch (err) {
      // Logout always succeeds even if API call fails (tokens are cleared)
      console.error("Logout error (tokens cleared):", err);
    }
  }, [ctxLogout]);

  return {
    // State
    isLoading,

    // Actions
    logout,
  };
}
