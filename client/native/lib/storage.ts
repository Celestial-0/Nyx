import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

import { REFRESH_TOKEN_STORAGE_KEY, TOKEN_STORAGE_KEY } from './env';

/**
 * Native storage adapters.
 *
 * The web client kept tokens in `localStorage` (synchronous) and persisted
 * Zustand stores there too. On native we split concerns:
 *
 *  - `tokenStorage` -> `expo-secure-store`, the OS keychain/keystore, for the
 *    sensitive access/refresh tokens. All operations are async.
 *  - `zustandStorage` -> `AsyncStorage`, a `StateStorage` adapter for the
 *    Zustand `persist` middleware (non-sensitive UI/session state).
 */

// SecureStore keys must match [A-Za-z0-9._-]; our env keys already comply.

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      await Promise.all([
        SecureStore.setItemAsync(TOKEN_STORAGE_KEY, accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, refreshToken),
      ]);
    } catch (error) {
      console.warn('Failed to store tokens:', error);
    }
  },

  async setAccessToken(accessToken: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, accessToken);
    } catch (error) {
      console.warn('Failed to store access token:', error);
    }
  },

  async clearTokens(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY),
      ]);
    } catch (error) {
      console.warn('Failed to clear tokens:', error);
    }
  },
};

/** AsyncStorage-backed adapter for `zustand/middleware` `persist`. */
export const zustandStorage: StateStorage = {
  getItem: (name) => AsyncStorage.getItem(name),
  setItem: (name, value) => AsyncStorage.setItem(name, value),
  removeItem: (name) => AsyncStorage.removeItem(name),
};
