import { useCallback, useEffect } from "react"

import {
  refreshAccessToken,
  requestNonce,
  signOut,
  validateSession,
  verifySignature,
} from "@/features/auth/auth.api"
import { getStoredAuthDeviceRegistration } from "@/features/auth/auth.device"
import { getAccessToken, getRefreshToken } from "@/features/auth/auth.tokens"
import { useAuthStore } from "@/features/auth/auth.store"
import type { RefreshRequest, VerifyRequest } from "@/features/auth/auth.types"
import {
  loadCurrentUserProfileAction,
  updateCurrentUserProfileAction,
} from "@/features/user/user.hooks"
import { useUserStore } from "@/features/user/user.store"
import { ApiRequestError } from "@/lib/api"

export { requestNonce }

const TOKEN_REFRESH_SKEW_MS = 60_000
let refreshPromise: Promise<boolean> | null = null

export async function bootstrapAuthSessionAction(): Promise<void> {
  const auth = useAuthStore.getState()
  const user = useUserStore.getState()
  const token = auth.accessToken || getAccessToken()

  if (!token) {
    user.clearProfile()
    auth.clearSession()
    return
  }

  auth.setLoading(true)
  auth.setError(null)

  try {
    const session = await validateSession(token)
    auth.applySessionSnapshot(session)

    if (!session.authenticated || !session.user) {
      user.clearProfile()
      auth.clearSession()
      auth.setLoading(false)
      return
    }

    await loadCurrentUserProfileAction(token)
  } catch {
    const refreshed = await refreshAuthSessionAction()

    if (!refreshed) {
      return
    }

    const nextToken = useAuthStore.getState().accessToken || getAccessToken()

    if (!nextToken) {
      user.clearProfile()
      auth.clearSession()
      return
    }

    const session = await validateSession(nextToken)
    auth.applySessionSnapshot(session)

    if (!session.authenticated || !session.user) {
      user.clearProfile()
      auth.clearSession()
      return
    }

    await loadCurrentUserProfileAction(nextToken)
  } finally {
    auth.setLoading(false)
  }
}

export async function verifyWalletSignInAction(payload: VerifyRequest) {
  const auth = useAuthStore.getState()

  auth.setLoading(true)
  auth.setError(null)

  try {
    const verified = await verifySignature(payload)
    auth.setAuthFromVerify(verified)

    if (!verified.accessToken) {
      useUserStore.getState().clearProfile()
      auth.setLoading(false)
      return verified
    }

    const session = await validateSession(verified.accessToken)
    auth.applySessionSnapshot(session)

    if (verified.profile.profileComplete) {
      await loadCurrentUserProfileAction(verified.accessToken)
    } else {
      useUserStore.getState().clearProfile()
    }

    auth.setLoading(false)
    return verified
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed"
    auth.setError(message)
    auth.setLoading(false)
    throw error
  }
}

export async function refreshAuthSessionAction(): Promise<boolean> {
  const auth = useAuthStore.getState()
  const refreshToken = auth.refreshToken || getRefreshToken()

  auth.setLoading(true)
  auth.setError(null)

  try {
    if (!refreshToken) {
      throw new Error("No refresh token")
    }

    const walletAddress = auth.user?.walletAddress
    const device = walletAddress
      ? getStoredAuthDeviceRegistration(walletAddress) ?? undefined
      : undefined
    const requestBody: RefreshRequest = {
      refreshToken,
      device,
    }
    const response = await refreshAccessToken(requestBody)
    auth.setTokensFromRefresh(response)
    const session = await validateSession(response.accessToken)
    auth.applySessionSnapshot(session)

    if (!session.authenticated || !session.user) {
      throw new Error("Session refresh did not return an authenticated session")
    }

    auth.setLoading(false)
    return true
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Session refresh failed"
    useUserStore.getState().clearProfile()
    auth.clearSession()
    auth.setError(message)
    auth.setLoading(false)
    return false
  }
}

export async function getAuthenticatedAccessToken(): Promise<string> {
  const auth = useAuthStore.getState()
  const accessToken = auth.accessToken || getAccessToken()

  if (
    accessToken &&
    (!auth.accessTokenExpiresAt ||
      auth.accessTokenExpiresAt - Date.now() > TOKEN_REFRESH_SKEW_MS)
  ) {
    return accessToken
  }

  if (!refreshPromise) {
    refreshPromise = refreshAuthSessionAction().finally(() => {
      refreshPromise = null
    })
  }

  const refreshed = await refreshPromise
  const nextToken = useAuthStore.getState().accessToken || getAccessToken()

  if (!refreshed || !nextToken) {
    throw new Error("Not authenticated")
  }

  return nextToken
}

export async function withAuthRetry<T>(
  operation: (accessToken: string) => Promise<T>
): Promise<T> {
  try {
    return await operation(await getAuthenticatedAccessToken())
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) {
      throw error
    }

    const refreshed = await refreshAuthSessionAction()
    const nextToken = useAuthStore.getState().accessToken || getAccessToken()

    if (!refreshed || !nextToken) {
      throw error
    }

    return operation(nextToken)
  }
}

export async function logoutAuthAction(): Promise<void> {
  const auth = useAuthStore.getState()

  try {
    if (auth.accessToken) {
      await signOut(auth.accessToken)
    }
  } finally {
    const { useChatStore } = await import("@/features/chat/chat.store")
    const { useContactsStore } = await import(
      "@/features/contacts/contacts.store"
    )
    useChatStore.getState().reset()
    useContactsStore.getState().reset()
    useUserStore.getState().clearProfile()
    auth.clearSession()
  }
}

export function useAuthSession() {
  const status = useAuthStore((state) => state.status)
  const isHydrated = useAuthStore((state) => state.isHydrated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const accessTokenExpiresAt = useAuthStore((state) => state.accessTokenExpiresAt)

  useEffect(() => {
    if (isHydrated && status === "idle") {
      void bootstrapAuthSessionAction()
    }
  }, [isHydrated, status])

  useEffect(() => {
    if (status !== "authenticated" || !accessTokenExpiresAt) {
      return
    }

    const refreshIn = Math.max(
      5_000,
      accessTokenExpiresAt - Date.now() - TOKEN_REFRESH_SKEW_MS
    )
    const timeoutId = window.setTimeout(() => {
      void refreshAuthSessionAction()
    }, refreshIn)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [accessTokenExpiresAt, status])

  return {
    isLoading,
    isAuthenticated: status === "authenticated",
    isUnauthenticated: status === "unauthenticated",
    status,
    isHydrated,
    initSession: bootstrapAuthSessionAction,
  }
}

export function useLogout() {
  const isLoading = useAuthStore((state) => state.isLoading)

  const logout = useCallback(async () => {
    try {
      await logoutAuthAction()
    } catch (error) {
      console.error("Logout error (session cleared):", error)
    }
  }, [])

  return {
    isLoading,
    logout,
  }
}

export function useRefresh() {
  const isLoading = useAuthStore((state) => state.isLoading)

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      return await refreshAuthSessionAction()
    } catch (error) {
      console.error("Token refresh failed:", error)
      return false
    }
  }, [])

  return {
    isLoading,
    refresh,
    refreshSession: refresh,
  }
}

export function useWalletAuth() {
  const isLoading = useAuthStore((state) => state.isLoading)
  const error = useAuthStore((state) => state.error)
  const profile = useUserStore((state) => state.profile)
  const setError = useAuthStore((state) => state.setError)

  const signIn = useCallback(
    async (payload: VerifyRequest) => {
      setError(null)
      return verifyWalletSignInAction(payload)
    },
    [setError]
  )

  const saveProfile = useCallback(
    async (patch: { username?: string; fullName?: string }) => {
      try {
        useAuthStore.getState().setLoading(true)
        setError(null)
        const updated = await updateCurrentUserProfileAction(patch)
        useAuthStore.getState().setLoading(false)
        return updated
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to save profile"
        setError(message)
        useAuthStore.getState().setLoading(false)
        throw error
      }
    },
    [setError]
  )

  return {
    isVerifying: isLoading,
    error,
    profile,
    signIn,
    saveProfile,
  }
}
