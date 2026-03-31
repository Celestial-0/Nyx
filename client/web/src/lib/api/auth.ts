/**
 * Auth API Transport Layer
 * Pure HTTP client for auth endpoints
 * All functions are pure: no side-effects, tokens taken as params
 */

import { API_BASE_URL } from "@/lib/api/config";
import type { ApiSuccessResponse } from "@/lib/api/config";
import type {
  NonceRequest,
  NonceResponse,
  VerifyRequest,
  VerifyResponse,
  RefreshRequest,
  RefreshResponse,
  SessionResponse,
  UpdateProfileRequest,
  UserProfile,
} from "@/api/auth/types";

/**
 * Parse API error message from response
 */
const asError = async (response: Response): Promise<string> => {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const data = (await response.json()) as {
      message?: string;
      error?: string;
    };
    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
};

/**
 * Request a nonce for wallet authentication
 * No side-effects; returns raw nonce payload
 */
export const requestNonce = async (
  body: NonceRequest
): Promise<NonceResponse> => {
  const response = await fetch(`${API_BASE_URL}/auth/nonce`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await asError(response));
  }

  const payload = (await response.json()) as ApiSuccessResponse<NonceResponse>;
  return payload.data;
};

/**
 * Verify wallet signature and establish session
 * IMPORTANT: Caller must handle token persistence (no side-effects here)
 */
export const verifySignature = async (
  body: VerifyRequest
): Promise<VerifyResponse> => {
  const response = await fetch(`${API_BASE_URL}/auth/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await asError(response));
  }

  const payload = (await response.json()) as ApiSuccessResponse<VerifyResponse>;
  return payload.data;
};

/**
 * Refresh access token using refresh token
 * Caller must handle token persistence
 * @param refreshToken - refresh token string (NOT loaded from localStorage)
 */
export const refreshAccessToken = async (
  refreshToken: string
): Promise<RefreshResponse> => {
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ refreshToken } as RefreshRequest),
  });

  if (!response.ok) {
    throw new Error(await asError(response));
  }

  const payload = (await response.json()) as ApiSuccessResponse<RefreshResponse>;
  return payload.data;
};

/**
 * Validate session with current access token
 * @param accessToken - access token string (NOT loaded from localStorage)
 */
export const validateSession = async (
  accessToken: string
): Promise<SessionResponse> => {
  if (!accessToken) {
    return { authenticated: false, user: null };
  }

  const response = await fetch(`${API_BASE_URL}/auth/session`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await asError(response));
  }

  const payload = (await response.json()) as ApiSuccessResponse<SessionResponse>;
  return payload.data;
};

/**
 * Sign out and invalidate session
 * @param accessToken - access token string (NOT loaded from localStorage)
 */
export const signOut = async (accessToken: string): Promise<void> => {
  if (!accessToken) {
    return;
  }

  const response = await fetch(`${API_BASE_URL}/auth/signout`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await asError(response));
  }
};

/**
 * Fetch authenticated user's full profile
 * @param accessToken - access token string (NOT loaded from localStorage)
 */
export const getMyProfile = async (
  accessToken: string
): Promise<UserProfile> => {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/users/me`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await asError(response));
  }

  const payload = (await response.json()) as ApiSuccessResponse<UserProfile>;
  return payload.data;
};

/**
 * Update authenticated user's profile
 * @param patch - profile updates (username, displayName)
 * @param accessToken - access token string (NOT loaded from localStorage)
 */
export const updateProfile = async (
  patch: UpdateProfileRequest,
  accessToken: string
): Promise<UserProfile> => {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/users/me`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    throw new Error(await asError(response));
  }

  const payload = (await response.json()) as ApiSuccessResponse<UserProfile>;
  return payload.data;
};
