/**
 * Token Storage Utilities
 * Pure localStorage operations for token persistence
 */

import { TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from "@/lib/api/config";

/**
 * Retrieve access token from localStorage
 */
export const getAccessToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Retrieve refresh token from localStorage
 */
export const getRefreshToken = (): string | null => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Store both access and refresh tokens in localStorage
 */
export const setTokens = (accessToken: string, refreshToken: string): void => {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  } catch (error) {
    console.warn("Failed to store tokens:", error);
  }
};

/**
 * Store access token only (used after refresh)
 */
export const setAccessToken = (accessToken: string): void => {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  } catch (error) {
    console.warn("Failed to store access token:", error);
  }
};

/**
 * Clear both tokens from localStorage
 */
export const clearTokens = (): void => {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear tokens:", error);
  }
};
