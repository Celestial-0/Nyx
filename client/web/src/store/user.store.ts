import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { clearTokens, setAccessToken, setTokens } from "@/api/auth/tokens";
import { signOut } from "@/lib/api/auth";
import type { VerifyResponse, UserProfile } from "@/api/auth/types";

type AuthStatus = "idle" | "authenticated" | "unauthenticated";

type UserConfig = {
	theme: "dark" | "light" | "system";
	notifications: boolean;
	compactMode: boolean;
	autoConnectWallet: boolean;
};

type UserStoreState = {
	status: AuthStatus;
	accessToken: string | null;
	refreshToken: string | null;
	profile: UserProfile | null;
	config: UserConfig;
	isHydrated: boolean;
	isLoading: boolean;
	error: string | null;
};

type UserStoreActions = {
	setHydrated: (value: boolean) => void;
	clearError: () => void;
	setConfig: (patch: Partial<UserConfig>) => void;
	setStatus: (status: AuthStatus) => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	setAccessToken: (token: string | null) => void;
	setRefreshToken: (token: string | null) => void;
	setProfile: (profile: UserProfile | null) => void;
	setTokensFromRefresh: (tokens: { accessToken: string; refreshToken: string }) => void;
	setAuthFromVerify: (payload: VerifyResponse) => void;
	logout: () => Promise<void>;
	reset: () => void;
};

type UserStore = UserStoreState & UserStoreActions;

const initialConfig: UserConfig = {
	theme: "system",
	notifications: true,
	compactMode: false,
	autoConnectWallet: true,
};

const initialState: UserStoreState = {
	status: "idle",
	accessToken: null,
	refreshToken: null,
	profile: null,
	config: initialConfig,
	isHydrated: false,
	isLoading: false,
	error: null,
};

const safeStorage = createJSONStorage(() => {
	if (typeof window === "undefined") {
		return {
			getItem: () => null,
			setItem: () => undefined,
			removeItem: () => undefined,
		};
	}

	return window.localStorage;
});

export const useUserStore = create<UserStore>()(
	persist(
		(set) => ({
			...initialState,

			setHydrated: (value) => set({ isHydrated: value }),

			clearError: () => set({ error: null }),

			setConfig: (patch) => {
				set((state) => ({
					config: {
						...state.config,
						...patch,
					},
				}));
			},

			setStatus: (status) => set({ status }),

			setLoading: (isLoading) => set({ isLoading }),

			setError: (error) => set({ error }),

			setAccessToken: (accessToken) => set({ accessToken }),

			setRefreshToken: (refreshToken) => set({ refreshToken }),

			setProfile: (profile) => set({ profile }),

			setTokensFromRefresh: ({ accessToken, refreshToken }) => {
				setAccessToken(accessToken);
				set({ accessToken, refreshToken, status: "authenticated" });
			},

			setAuthFromVerify: (payload) => {
				setTokens(payload.accessToken, payload.refreshToken);
				set({
					status: "authenticated",
					accessToken: payload.accessToken,
					refreshToken: payload.refreshToken,
					profile: null,
					error: null,
				});
			},

			logout: async () => {
				try {
					const token = useUserStore.getState().accessToken;
					if (token) {
						await signOut(token);
					}
				} finally {
					clearTokens();
					set({
						status: "unauthenticated",
						accessToken: null,
						refreshToken: null,
						profile: null,
						error: null,
						isLoading: false,
					});
				}
			},

			reset: () => {
				clearTokens();
				set({
					...initialState,
					status: "unauthenticated",
					isHydrated: true,
				});
			},
		}),
		{
			name: "nyx-user-store",
			storage: safeStorage,
			partialize: (state) => ({
				accessToken: state.accessToken,
				refreshToken: state.refreshToken,
				config: state.config,
			}),
			onRehydrateStorage: () => (state) => {
				state?.setHydrated(true);
			},
		}
	)
);

export const useAuthStatus = () => useUserStore((state) => state.status);
export const useCurrentUser = () => useUserStore((state) => state.profile);
export const useUserConfig = () => useUserStore((state) => state.config);
