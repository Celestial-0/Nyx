import {
  type CreateGroupRoomInput,
  JoinRoomResponseSchema,
  LeaveRoomResponseSchema,
  RoomDeleteResponseSchema,
  RoomDetailSchema,
  RoomMemberRoleUpdateResponseSchema,
  RoomMembersResponseSchema,
  RoomMuteResponseSchema,
} from '@/types';

import { apiRequest } from './client';

export async function createGroupRoom(input: CreateGroupRoomInput, accessToken: string) {
  return RoomDetailSchema.parse(
    await apiRequest('/rooms', { method: 'POST', accessToken, body: input })
  );
}

export async function getRoom(roomId: string, accessToken: string) {
  return RoomDetailSchema.parse(
    await apiRequest(`/rooms/${roomId}`, { method: 'GET', accessToken })
  );
}

export async function getRoomMembers(roomId: string, accessToken: string) {
  return RoomMembersResponseSchema.parse(
    await apiRequest(`/rooms/${roomId}/members`, { method: 'GET', accessToken })
  );
}

export async function joinRoom(roomId: string, accessToken: string) {
  return JoinRoomResponseSchema.parse(
    await apiRequest(`/rooms/${roomId}/join`, { method: 'POST', accessToken })
  );
}

export async function leaveRoom(roomId: string, accessToken: string) {
  return LeaveRoomResponseSchema.parse(
    await apiRequest(`/rooms/${roomId}/leave`, { method: 'POST', accessToken })
  );
}

export async function updateRoomMute(
  roomId: string,
  mutedUntil: string | null,
  accessToken: string
) {
  return RoomMuteResponseSchema.parse(
    await apiRequest(`/rooms/${roomId}/mute`, {
      method: 'PATCH',
      accessToken,
      body: { mutedUntil },
    })
  );
}

export async function updateRoomMemberRole(
  roomId: string,
  userId: string,
  role: 'admin' | 'member',
  accessToken: string
) {
  return RoomMemberRoleUpdateResponseSchema.parse(
    await apiRequest(`/rooms/${roomId}/members/${userId}/role`, {
      method: 'PATCH',
      accessToken,
      body: { role },
    })
  );
}

export async function deleteRoom(roomId: string, accessToken: string) {
  return RoomDeleteResponseSchema.parse(
    await apiRequest(`/rooms/${roomId}`, { method: 'DELETE', accessToken })
  );
}
