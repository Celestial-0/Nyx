/**
 * Environment + storage-key resolution for the native client.
 *
 * Expo inlines any `EXPO_PUBLIC_*` variable into the JS bundle at build time,
 * so these are read from `process.env` (the RN equivalent of the web client's
 * `import.meta.env.VITE_*`).
 */

function coerceEnvValue(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
    return undefined;
  }

  return trimmed;
}

import { Platform } from 'react-native';

const apiBaseUrl =
  coerceEnvValue(process.env.EXPO_PUBLIC_NYX_API_URL) ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

/** Base URL of the Nyx API, with any trailing slashes stripped. */
export const API_BASE_URL = apiBaseUrl.replace(/\/+$/, '');

/** SecureStore keys for the auth tokens. */
export const TOKEN_STORAGE_KEY = 'nyx_access_token';
export const REFRESH_TOKEN_STORAGE_KEY = 'nyx_refresh_token';
