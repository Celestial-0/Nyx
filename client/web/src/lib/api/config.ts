/**
 * API Configuration and Constants
 */

export const API_BASE_URL = import.meta.env.VITE_NYX_API_URL || "http://localhost:8000";

/** Token storage keys for localStorage */
export const TOKEN_STORAGE_KEY = "nyx_access_token";
export const REFRESH_TOKEN_STORAGE_KEY = "nyx_refresh_token";

/** API Error response shape (internal) */
export type ApiErrorResponse = {
  success: false;
  error: string;
  message: string;
};

/** API Success response wrapper (internal) */
export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};
