import { apiRequest } from "@/lib/api"

import type {
  NonceRequest,
  NonceResponse,
  RefreshRequest,
  RefreshResponse,
  SessionResponse,
  VerifyRequest,
  VerifyResponse,
} from "./auth.types"

export async function requestNonce(body: NonceRequest): Promise<NonceResponse> {
  return apiRequest<NonceResponse>("/auth/nonce", {
    method: "POST",
    body,
  })
}

export async function verifySignature(
  body: VerifyRequest
): Promise<VerifyResponse> {
  return apiRequest<VerifyResponse>("/auth/verify", {
    method: "POST",
    body,
  })
}

export async function refreshAccessToken(
  body: RefreshRequest
): Promise<RefreshResponse> {
  if (!body.refreshToken) {
    throw new Error("No refresh token available")
  }

  return apiRequest<RefreshResponse>("/auth/refresh", {
    method: "POST",
    body,
  })
}

export async function validateSession(
  accessToken: string
): Promise<SessionResponse> {
  if (!accessToken) {
    return {
      authenticated: false,
      user: null,
      activeDevice: null,
      prekeyStatus: null,
    }
  }

  return apiRequest<SessionResponse>("/auth/session", {
    method: "GET",
    accessToken,
  })
}

export async function signOut(
  accessToken: string,
  revokeDevice = false
): Promise<void> {
  if (!accessToken) {
    return
  }

  await apiRequest<void>("/auth/signout", {
    method: "POST",
    accessToken,
    body: { revokeDevice },
  })
}
