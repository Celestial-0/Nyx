import { useCallback } from "react"

import { useAuthStore } from "@/features/auth/auth.store"

import {
  createGroupRoom,
  getRoom,
  getRoomMembers,
  joinRoom,
  leaveRoom,
} from "./rooms.api"

function requireAccessToken() {
  const accessToken = useAuthStore.getState().accessToken

  if (!accessToken) {
    throw new Error("Not authenticated")
  }

  return accessToken
}

export function useRoomActions() {
  const createRoom = useCallback(async () => {
    return createGroupRoom({ type: "group" }, requireAccessToken())
  }, [])

  const fetchRoom = useCallback(async (roomId: string) => {
    return getRoom(roomId, requireAccessToken())
  }, [])

  const fetchRoomMembers = useCallback(async (roomId: string) => {
    return getRoomMembers(roomId, requireAccessToken())
  }, [])

  const join = useCallback(async (roomId: string) => {
    return joinRoom(roomId, requireAccessToken())
  }, [])

  const leave = useCallback(async (roomId: string) => {
    return leaveRoom(roomId, requireAccessToken())
  }, [])

  return {
    createRoom,
    fetchRoom,
    fetchRoomMembers,
    join,
    leave,
  }
}
