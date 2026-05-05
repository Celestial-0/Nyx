import { apiRequest } from "@/lib/api"

import type {
  CreateGroupRoomInput,
  RoomDeleteResponse,
  JoinRoomResponse,
  LeaveRoomResponse,
  RoomDetail,
  RoomMemberRoleUpdateResponse,
  RoomMembersResponse,
  RoomMuteResponse,
} from "./rooms.types"

export function createGroupRoom(
  input: CreateGroupRoomInput,
  accessToken: string
) {
  return apiRequest<RoomDetail>("/rooms", {
    method: "POST",
    accessToken,
    body: input,
  })
}

export function getRoom(roomId: string, accessToken: string) {
  return apiRequest<RoomDetail>(`/rooms/${roomId}`, {
    method: "GET",
    accessToken,
  })
}

export function getRoomMembers(roomId: string, accessToken: string) {
  return apiRequest<RoomMembersResponse>(`/rooms/${roomId}/members`, {
    method: "GET",
    accessToken,
  })
}

export function joinRoom(roomId: string, accessToken: string) {
  return apiRequest<JoinRoomResponse>(`/rooms/${roomId}/join`, {
    method: "POST",
    accessToken,
  })
}

export function leaveRoom(roomId: string, accessToken: string) {
  return apiRequest<LeaveRoomResponse>(`/rooms/${roomId}/leave`, {
    method: "POST",
    accessToken,
  })
}

export function updateRoomMute(
  roomId: string,
  mutedUntil: string | null,
  accessToken: string
) {
  return apiRequest<RoomMuteResponse>(`/rooms/${roomId}/mute`, {
    method: "PATCH",
    accessToken,
    body: { mutedUntil },
  })
}

export function updateRoomMemberRole(
  roomId: string,
  userId: string,
  role: "admin" | "member",
  accessToken: string
) {
  return apiRequest<RoomMemberRoleUpdateResponse>(
    `/rooms/${roomId}/members/${userId}/role`,
    {
      method: "PATCH",
      accessToken,
      body: { role },
    }
  )
}

export function deleteRoom(roomId: string, accessToken: string) {
  return apiRequest<RoomDeleteResponse>(`/rooms/${roomId}`, {
    method: "DELETE",
    accessToken,
  })
}
