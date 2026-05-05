import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { clearTokens, setTokens } from "@/features/auth/auth.tokens"
import type {
  AuthSessionUser,
  E2eeActiveDevice,
  E2eePreKeyInventoryStatus,
  RefreshResponse,
  SessionResponse,
  VerifyResponse,
} from "@/features/auth/auth.types"

export type AuthStatus = "idle" | "authenticated" | "unauthenticated"

type AuthStoreState = {
  status: AuthStatus
  accessToken: string | null
  refreshToken: string | null
  accessTokenExpiresAt: number | null
  user: AuthSessionUser | null
  activeDevice: E2eeActiveDevice | null
  prekeyStatus: E2eePreKeyInventoryStatus | null
  isHydrated: boolean
  isLoading: boolean
  error: string | null
}

type AuthStoreActions = {
  setHydrated: (value: boolean) => void
  setStatus: (status: AuthStatus) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setAccessToken: (token: string | null) => void
  setRefreshToken: (token: string | null) => void
  applySessionSnapshot: (payload: SessionResponse) => void
  setTokensFromRefresh: (payload: RefreshResponse) => void
  setAuthFromVerify: (payload: VerifyResponse) => void
  clearSession: () => void
  reset: () => void
}

export type AuthStore = AuthStoreState & AuthStoreActions

const initialState: AuthStoreState = {
  status: "idle",
  accessToken: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  user: null,
  activeDevice: null,
  prekeyStatus: null,
  isHydrated: false,
  isLoading: false,
  error: null,
}

const safeStorage = createJSONStorage(() => {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    }
  }

  return window.localStorage
})

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      setHydrated: (value) => set({ isHydrated: value }),
      setStatus: (status) => set({ status }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),

      applySessionSnapshot: (payload) =>
        set({
          status: payload.authenticated ? "authenticated" : "unauthenticated",
          user: payload.user,
          activeDevice: payload.activeDevice,
          prekeyStatus: payload.prekeyStatus,
          error: null,
        }),

      setTokensFromRefresh: (payload) => {
        setTokens(payload.accessToken, payload.refreshToken)
        set({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          accessTokenExpiresAt: Date.now() + payload.expiresIn * 1000,
          status: "authenticated",
          activeDevice: payload.activeDevice,
          prekeyStatus: payload.prekeyStatus,
          error: null,
        })
      },

      setAuthFromVerify: (payload) => {
        if (!payload.accessToken || !payload.refreshToken) {
          set({
            status: "unauthenticated",
            user: null,
            activeDevice: payload.activeDevice,
            prekeyStatus: payload.prekeyStatus,
            accessToken: null,
            refreshToken: null,
            accessTokenExpiresAt: null,
            error: payload.deviceRegistrationRequired
              ? "Device registration is required before chat can start."
              : "Authentication did not return a valid session.",
          })
          return
        }

        setTokens(payload.accessToken, payload.refreshToken)
        set({
          status: "authenticated",
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          accessTokenExpiresAt:
            payload.expiresIn == null
              ? null
              : Date.now() + payload.expiresIn * 1000,
          user: null,
          activeDevice: payload.activeDevice,
          prekeyStatus: payload.prekeyStatus,
          error: null,
        })
      },

      clearSession: () => {
        clearTokens()
        set({
          status: "unauthenticated",
          accessToken: null,
          refreshToken: null,
          accessTokenExpiresAt: null,
          user: null,
          activeDevice: null,
          prekeyStatus: null,
          error: null,
          isLoading: false,
        })
      },

      reset: () => {
        clearTokens()
        set({
          ...initialState,
          status: "unauthenticated",
          isHydrated: true,
        })
      },
    }),
    {
      name: "nyx-auth-store",
      storage: safeStorage,
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        accessTokenExpiresAt: state.accessTokenExpiresAt,
        user: state.user,
        activeDevice: state.activeDevice,
        prekeyStatus: state.prekeyStatus,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    }
  )
)
