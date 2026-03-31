/**
 * useAuthSession
 * 
 * Hook for session initialization and auth status checks
 * 
 * Usage:
 *   const { isLoading, isAuthenticated, initSession } = useAuthSession();
 */

import { useEffect } from "react";
import { useUserStore } from "@/store/user.store";
import { useAuth } from "@/context/auth.context";

export function useAuthSession() {
  const status = useUserStore((state) => state.status);
  const isHydrated = useUserStore((state) => state.isHydrated);
  const isLoading = useUserStore((state) => state.isLoading);
  const { bootstrapSession } = useAuth();

  // Auto-initialize session on first hydration
  useEffect(() => {
    if (isHydrated && status === "idle") {
      void bootstrapSession();
    }
  }, [isHydrated, status, bootstrapSession]);

  const isAuthenticated = status === "authenticated";
  const isUnauthenticated = status === "unauthenticated";

  return {
    // State
    isLoading,
    isAuthenticated,
    isUnauthenticated,
    status,
    isHydrated,

    // Actions
    initSession: bootstrapSession,
  };
}
