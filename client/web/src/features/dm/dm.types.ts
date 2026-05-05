import type { E2eePeerDeviceBundle } from "@/features/auth/auth.types"
import type { RoomSummary } from "@/features/rooms/rooms.types"

export type StartDirectConversationInput = {
  username?: string
  walletAddress?: string
}

export type StartDirectConversationResponse = {
  conversation: RoomSummary
  created: boolean
  peerUserId: string
  peerDeviceBundles: E2eePeerDeviceBundle[]
}
