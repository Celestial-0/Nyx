import {
  type NonceRequest,
  type NonceResponse,
  NonceResponseSchema,
  type RefreshRequest,
  type RefreshResponse,
  RefreshResponseSchema,
  type SessionResponse,
  SessionResponseSchema,
  type VerifyRequest,
  type VerifyResponse,
  VerifyResponseSchema,
} from '@/types';

import { apiRequest } from './client';

export async function requestNonce(body: NonceRequest): Promise<NonceResponse> {
  return NonceResponseSchema.parse(
    await apiRequest('/auth/nonce', { method: 'POST', body })
  );
}

export async function verifySignature(body: VerifyRequest): Promise<VerifyResponse> {
  return VerifyResponseSchema.parse(
    await apiRequest('/auth/verify', { method: 'POST', body })
  );
}

export async function refreshAccessToken(body: RefreshRequest): Promise<RefreshResponse> {
  if (!body.refreshToken) {
    throw new Error('No refresh token available');
  }

  return RefreshResponseSchema.parse(
    await apiRequest('/auth/refresh', { method: 'POST', body })
  );
}

export async function validateSession(accessToken: string): Promise<SessionResponse> {
  if (!accessToken) {
    return { authenticated: false, user: null, activeDevice: null, prekeyStatus: null };
  }

  return SessionResponseSchema.parse(
    await apiRequest('/auth/session', { method: 'GET', accessToken })
  );
}

export async function signOut(accessToken: string, revokeDevice = false): Promise<void> {
  if (!accessToken) {
    return;
  }

  await apiRequest<void>('/auth/signout', {
    method: 'POST',
    accessToken,
    body: { revokeDevice },
  });
}
