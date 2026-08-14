import { ApiRequestError, authApi, userApi } from '@/lib/api';
import { getOrCreateLocalDevice, hydrateDeviceStore } from '@/lib/e2ee';
import { tokenStorage } from '@/lib/storage';
import { authorizeSession, resetWalletSession, signMessage } from '@/lib/wallet';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { useContactsStore } from '@/store/contacts.store';
import { useUserStore } from '@/store/user.store';
import type { UpdateProfileRequest, VerifyRequest } from '@/types';

/**
 * Auth session orchestration. Ported from the web client's
 * `features/auth/auth.hooks.ts`, adapted for native:
 *  - token reads are async (SecureStore via `tokenStorage`)
 *  - wallet sign-in + E2EE device registration go through MWA (`lib/wallet`)
 *    and the real crypto in `lib/e2ee`.
 */

export const TOKEN_REFRESH_SKEW_MS = 60_000;
let refreshPromise: Promise<boolean> | null = null;

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function readAccessToken(): Promise<string | null> {
  return useAuthStore.getState().accessToken ?? (await tokenStorage.getAccessToken());
}

/**
 * Full wallet sign-in flow (ported from web `WalletAuth` + `auth.hooks`):
 * authorize via MWA → nonce → sign → register device (real E2EE keys) → verify.
 */
export async function signInWithWallet(): Promise<void> {
  const auth = useAuthStore.getState();
  auth.setLoading(true);
  auth.setError(null);

  try {
    // Local device keys are kept keyed by wallet; make sure the cache is warm.
    await hydrateDeviceStore();

    const session = await authorizeSession();
    const walletAddress = session.address;

    const nonce = await authApi.requestNonce({ walletAddress });
    const signature = await signMessage(encodeUtf8(nonce.message));
    const { default: bs58 } = await import('bs58');

    const device = await getOrCreateLocalDevice({
      walletAddress,
      signMessage,
    });

    await verifyWalletSignIn({
      walletAddress,
      nonce: nonce.nonce,
      message: nonce.message,
      signature: bs58.encode(signature),
      device: device.registration,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect wallet';
    useAuthStore.getState().setError(message);
    throw error;
  } finally {
    useAuthStore.getState().setLoading(false);
  }
}

export async function loadCurrentUserProfile(token: string) {
  const profile = await userApi.getMyProfile(token);
  useUserStore.getState().setProfile(profile);
  return profile;
}

export async function bootstrapAuthSession(): Promise<void> {
  const auth = useAuthStore.getState();
  const user = useUserStore.getState();

  // Warm the local E2EE device cache before any decryption happens.
  await hydrateDeviceStore();

  const token = await readAccessToken();

  if (!token) {
    user.clearProfile();
    auth.clearSession();
    return;
  }

  auth.setLoading(true);
  auth.setError(null);

  try {
    const session = await authApi.validateSession(token);
    auth.applySessionSnapshot(session);

    if (!session.authenticated || !session.user) {
      user.clearProfile();
      auth.clearSession();
      return;
    }

    await loadCurrentUserProfile(token);
  } catch {
    const refreshed = await refreshAuthSession();
    if (!refreshed) {
      return;
    }

    const nextToken = await readAccessToken();
    if (!nextToken) {
      user.clearProfile();
      auth.clearSession();
      return;
    }

    try {
      const session = await authApi.validateSession(nextToken);
      auth.applySessionSnapshot(session);

      if (!session.authenticated || !session.user) {
        user.clearProfile();
        auth.clearSession();
        return;
      }

      await loadCurrentUserProfile(nextToken);
    } catch {
      user.clearProfile();
      auth.clearSession();
    }
  } finally {
    useAuthStore.getState().setLoading(false);
  }
}

export async function refreshAuthSession(): Promise<boolean> {
  const auth = useAuthStore.getState();
  const refreshToken = auth.refreshToken ?? (await tokenStorage.getRefreshToken());

  auth.setLoading(true);
  auth.setError(null);

  try {
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await authApi.refreshAccessToken({ refreshToken });
    auth.setTokensFromRefresh(response);

    const session = await authApi.validateSession(response.accessToken);
    auth.applySessionSnapshot(session);

    if (!session.authenticated || !session.user) {
      throw new Error('Session refresh did not return an authenticated session');
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Session refresh failed';
    useUserStore.getState().clearProfile();
    auth.clearSession();
    auth.setError(message);
    return false;
  } finally {
    useAuthStore.getState().setLoading(false);
  }
}

export async function verifyWalletSignIn(payload: VerifyRequest) {
  const auth = useAuthStore.getState();

  auth.setLoading(true);
  auth.setError(null);

  try {
    const verified = await authApi.verifySignature(payload);
    auth.setAuthFromVerify(verified);

    if (!verified.accessToken) {
      useUserStore.getState().clearProfile();
      return verified;
    }

    const session = await authApi.validateSession(verified.accessToken);
    auth.applySessionSnapshot(session);

    if (verified.profile.profileComplete) {
      await loadCurrentUserProfile(verified.accessToken);
    } else {
      useUserStore.getState().clearProfile();
    }

    return verified;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    auth.setError(message);
    throw error;
  } finally {
    useAuthStore.getState().setLoading(false);
  }
}

export async function saveCurrentUserProfile(patch: UpdateProfileRequest) {
  const token = await getAuthenticatedAccessToken();
  const profile = await userApi.updateProfile(patch, token);
  useUserStore.getState().setProfile(profile);
  return profile;
}

export async function getAuthenticatedAccessToken(): Promise<string> {
  const auth = useAuthStore.getState();
  const accessToken = await readAccessToken();

  if (
    accessToken &&
    (!auth.accessTokenExpiresAt ||
      auth.accessTokenExpiresAt - Date.now() > TOKEN_REFRESH_SKEW_MS)
  ) {
    return accessToken;
  }

  if (!refreshPromise) {
    refreshPromise = refreshAuthSession().finally(() => {
      refreshPromise = null;
    });
  }

  const refreshed = await refreshPromise;
  const nextToken = await readAccessToken();

  if (!refreshed || !nextToken) {
    throw new Error('Not authenticated');
  }

  return nextToken;
}

export async function withAuthRetry<T>(
  operation: (accessToken: string) => Promise<T>
): Promise<T> {
  try {
    return await operation(await getAuthenticatedAccessToken());
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) {
      throw error;
    }

    const refreshed = await refreshAuthSession();
    const nextToken = await readAccessToken();

    if (!refreshed || !nextToken) {
      throw error;
    }

    return operation(nextToken);
  }
}

export async function logoutAuthSession(): Promise<void> {
  const auth = useAuthStore.getState();

  try {
    if (auth.accessToken) {
      await authApi.signOut(auth.accessToken);
    }
  } finally {
    useChatStore.getState().reset();
    useContactsStore.getState().reset();
    useUserStore.getState().clearProfile();
    resetWalletSession();
    auth.clearSession();
  }
}
