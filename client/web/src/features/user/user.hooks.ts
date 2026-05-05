import { useCallback } from "react"

import { useAuthStore } from "@/features/auth/auth.store"
import type { UpdateProfileRequest } from "@/features/auth/auth.types"

import { getMyProfile, updateProfile } from "./user.api"
import { useUserStore } from "./user.store"

export async function loadCurrentUserProfileAction(accessToken?: string) {
  const token = accessToken ?? useAuthStore.getState().accessToken

  if (!token) {
    useUserStore.getState().clearProfile()
    throw new Error("Not authenticated")
  }

  const profile = await getMyProfile(token)
  useUserStore.getState().setProfile(profile)
  return profile
}

export async function updateCurrentUserProfileAction(
  patch: UpdateProfileRequest
) {
  const token = useAuthStore.getState().accessToken

  if (!token) {
    throw new Error("Not authenticated")
  }

  const profile = await updateProfile(patch, token)
  useUserStore.getState().setProfile(profile)
  return profile
}

export function useProfile() {
  const profile = useUserStore((state) => state.profile)
  const isLoading = useAuthStore((state) => state.isLoading)
  const error = useAuthStore((state) => state.error)
  const setError = useAuthStore((state) => state.setError)

  const loadProfile = useCallback(async () => {
    try {
      setError(null)
      return await loadCurrentUserProfileAction()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load profile"
      setError(message)
      throw error
    }
  }, [setError])

  const saveProfile = useCallback(
    async (patch: UpdateProfileRequest) => {
      try {
        setError(null)
        return await updateCurrentUserProfileAction(patch)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update profile"
        setError(message)
        throw error
      }
    },
    [setError]
  )

  return {
    profile,
    isLoading,
    error,
    loadProfile,
    updateProfile: saveProfile,
  }
}

export function useCurrentUser() {
  return useUserStore((state) => state.profile)
}

export function useUserConfig() {
  return useUserStore((state) => state.config)
}
