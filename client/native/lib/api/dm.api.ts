import {
  type StartDirectConversationInput,
  StartDirectConversationResponseSchema,
} from '@/types';

import { apiRequest } from './client';

export async function startDirectConversation(
  input: StartDirectConversationInput,
  accessToken: string
) {
  return StartDirectConversationResponseSchema.parse(
    await apiRequest('/dm/start', { method: 'POST', accessToken, body: input })
  );
}
