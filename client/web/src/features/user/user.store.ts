import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { UserConfig, UserProfile } from "./user.types"

type UserStoreState = {
  profile: UserProfile | null
  config: UserConfig
}

type UserStoreActions = {
  setProfile: (profile: UserProfile | null) => void
  clearProfile: () => void
  setConfig: (patch: Partial<UserConfig>) => void
  reset: () => void
}

export type UserStore = UserStoreState & UserStoreActions

const initialConfig: UserConfig = {
  theme: "dark",
  notifications: true,
  compactMode: false,
  autoConnectWallet: true,
  sharePresence: true,
}

const initialState: UserStoreState = {
  profile: null,
  config: initialConfig,
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

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      ...initialState,
      setProfile: (profile) => set({ profile }),
      clearProfile: () => set({ profile: null }),
      setConfig: (patch) =>
        set((state) => ({
          config: {
            ...state.config,
            ...patch,
          },
        })),
      reset: () =>
        set({
          ...initialState,
        }),
    }),
    {
      name: "nyx-user-store",
      storage: safeStorage,
      partialize: (state) => ({
        config: state.config,
      }),
    }
  )
)
