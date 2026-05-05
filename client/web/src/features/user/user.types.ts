import { z } from "zod"

export type UserConfig = {
  theme: "dark" | "light" | "system"
  notifications: boolean
  compactMode: boolean
  autoConnectWallet: boolean
  sharePresence: boolean
}

export const UserConfigSchema: z.ZodType<UserConfig> = z.object({
  theme: z.enum(["dark", "light", "system"]),
  notifications: z.boolean(),
  compactMode: z.boolean(),
  autoConnectWallet: z.boolean(),
  sharePresence: z.boolean(),
})

export type UserProfile = {
  id: string
  walletAddress: string
  username: string | null
  displayName: string | null
  role: string | null
  createdAt: string
  updatedAt: string
}

export type UserDirectoryEntry = UserProfile

export const UserProfileSchema: z.ZodType<UserProfile> = z.object({
  id: z.string(),
  walletAddress: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  role: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
