import { z } from 'zod';

import { E2eePeerDeviceBundleSchema } from './e2ee';
import { RoomSummarySchema } from './rooms';

/** Direct-message start schemas. Ported from web `features/dm`. */

export const StartDirectConversationInputSchema = z
  .object({
    username: z.string().optional(),
    walletAddress: z.string().optional(),
  })
  .refine((value) => Boolean(value.username || value.walletAddress), {
    message: 'Provide either a username or a wallet address.',
  });

export const StartDirectConversationResponseSchema = z.object({
  conversation: RoomSummarySchema,
  created: z.boolean(),
  peerUserId: z.string(),
  peerDeviceBundles: z.array(E2eePeerDeviceBundleSchema),
});

export type StartDirectConversationInput = z.infer<typeof StartDirectConversationInputSchema>;
export type StartDirectConversationResponse = z.infer<
  typeof StartDirectConversationResponseSchema
>;
