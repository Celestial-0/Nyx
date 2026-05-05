import { REFRESH_TOKEN_STORAGE_KEY, TOKEN_STORAGE_KEY } from "@/lib/api"

export const getAccessToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export const getRefreshToken = (): string | null => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export const setTokens = (accessToken: string, refreshToken: string): void => {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken)
  } catch (error) {
    console.warn("Failed to store tokens:", error)
  }
}

export const setAccessToken = (accessToken: string): void => {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken)
  } catch (error) {
    console.warn("Failed to store access token:", error)
  }
}

export const clearTokens = (): void => {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch (error) {
    console.warn("Failed to clear tokens:", error)
  }
}
