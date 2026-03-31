/**
 * useWalletAuth
 * 
 * Hook for wallet sign-in flow
 * Handles: request nonce → sign message → verify signature → complete profile
 * 
 * Usage:
 *   const { requestSignIn, isVerifying, error } = useWalletAuth();
 *   await requestSignIn(walletAddress, message, signature);
 */

import { useCallback } from "react";
import { useUserStore } from "@/store/user.store";
import { useAuth } from "@/context/auth.context";

export function useWalletAuth() {
  const isLoading = useUserStore((state) => state.isLoading);
  const error = useUserStore((state) => state.error);
  const profile = useUserStore((state) => state.profile);
  const setError = useUserStore((state) => state.setError);
  const setLoading = useUserStore((state) => state.setLoading);

  const { verifyAndSignIn, completeProfile } = useAuth();

  /**
   * Sign in with wallet signature
   */
  const signIn = useCallback(
    async (payload: {
      walletAddress: string;
      nonce: string;
      message: string;
      signature: string;
    }) => {
      try {
        setLoading(true);
        setError(null);
        await verifyAndSignIn(payload);
        setLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sign in failed";
        setError(message);
        setLoading(false);
        throw err;
      }
    },
    [verifyAndSignIn, setLoading, setError]
  );

  /**
   * Complete profile after first sign-in
   */
  const saveProfile = useCallback(
    async (patch: { username?: string; displayName?: string }) => {
      try {
        setLoading(true);
        setError(null);
        await completeProfile(patch);
        setLoading(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to save profile";
        setError(message);
        setLoading(false);
        throw err;
      }
    },
    [completeProfile, setLoading, setError]
  );

  return {
    // State
    isVerifying: isLoading,
    error,
    profile,

    // Actions
    signIn,
    saveProfile,
  };
}
