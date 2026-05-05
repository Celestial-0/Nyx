import { useCallback } from "react"

import { useAuthStore } from "@/features/auth/auth.store"

import { startDirectConversation } from "./dm.api"

export function useDirectMessageActions() {
  const startConversation = useCallback(
    async (input: { username?: string; walletAddress?: string }) => {
      const accessToken = useAuthStore.getState().accessToken

      if (!accessToken) {
        throw new Error("Not authenticated")
      }

      return startDirectConversation(input, accessToken)
    },
    []
  )

  return {
    startConversation,
  }
}
