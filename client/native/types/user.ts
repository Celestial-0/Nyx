import { z } from 'zod';

import { IsoDateStringSchema } from './common';

/** User profile + local client config. Ported from web `features/user`. */

export const UserConfigSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  notifications: z.boolean(),
  compactMode: z.boolean(),
  autoConnectWallet: z.boolean(),
  sharePresence: z.boolean(),
});

export const UserProfileSchema = z.object({
  id: z.string(),
  walletAddress: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  role: z.string().nullable(),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
});

/** A directory entry is the same shape as a profile. */
export const UserDirectoryEntrySchema = UserProfileSchema;

export type UserConfig = z.infer<typeof UserConfigSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserDirectoryEntry = z.infer<typeof UserDirectoryEntrySchema>;
