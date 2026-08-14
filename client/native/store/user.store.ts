import { zustandStorage } from '@/lib/storage';
import type { UserConfig, UserProfile } from '@/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * User profile + local config store. Ported from web `features/user/user.store.ts`.
 * Only `config` is persisted (via AsyncStorage); the profile is refetched.
 */

type UserStoreState = {
  profile: UserProfile | null;
  config: UserConfig;
};

type UserStoreActions = {
  setProfile: (profile: UserProfile | null) => void;
  clearProfile: () => void;
  setConfig: (patch: Partial<UserConfig>) => void;
  reset: () => void;
};

export type UserStore = UserStoreState & UserStoreActions;

const initialConfig: UserConfig = {
  theme: 'dark',
  notifications: true,
  compactMode: false,
  autoConnectWallet: true,
  sharePresence: true,
};

const initialState: UserStoreState = {
  profile: null,
  config: initialConfig,
};

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      ...initialState,
      setProfile: (profile) => set({ profile }),
      clearProfile: () => set({ profile: null }),
      setConfig: (patch) =>
        set((state) => ({ config: { ...state.config, ...patch } })),
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'nyx-user-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({ config: state.config }),
    }
  )
);
