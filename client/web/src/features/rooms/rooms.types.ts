import type {
  E2eePeerDeviceBundle,
  E2eeSenderKeyEpochState,
} from "@/features/auth/auth.types"

export type RoomType = "direct" | "group"

export type RoomMemberRole = "admin" | "member"

export type RoomSummary = {
  id: string
  type: RoomType
  createdBy: string
  lastMessageId: string | null
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}

export type RoomMembership = {
  role: RoomMemberRole
  joinedAt: string
  mutedUntil: string | null
}

export type RoomDetail = {
  room: RoomSummary
  membership: RoomMembership
  senderKeyState: E2eeSenderKeyEpochState | null
}

export type RoomMember = {
  userId: string
  walletAddress: string
  username: string | null
  displayName: string | null
  role: RoomMemberRole
  joinedAt: string
  mutedUntil: string | null
  devices: E2eePeerDeviceBundle[]
}

export type RoomMembersResponse = {
  roomId: string
  members: RoomMember[]
}

export type CreateGroupRoomInput = {
  type: "group"
}

export type JoinRoomResponse = {
  joined: true
  room: RoomSummary
  membership: RoomMembership
  senderKeyState: E2eeSenderKeyEpochState | null
}

export type LeaveRoomResponse = {
  roomId: string
  left: true
}

export type RoomMuteResponse = {
  roomId: string
  mutedUntil: string | null
}

export type RoomMemberRoleUpdateResponse = {
  roomId: string
  member: RoomMember
}

export type RoomDeleteResponse = {
  roomId: string
  deleted: true
}
