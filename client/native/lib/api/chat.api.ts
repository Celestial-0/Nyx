import {
  type ChatConversationListResponse,
  ChatConversationListResponseSchema,
  type ChatHistoryQuery,
  type ChatHistoryResponse,
  ChatHistoryResponseSchema,
} from '@/types';
import { z } from 'zod';

import { apiRequest } from './client';

export async function getConversationList(
  accessToken: string
): Promise<ChatConversationListResponse> {
  return ChatConversationListResponseSchema.parse(
    await apiRequest('/chat/conversations', { method: 'GET', accessToken })
  );
}

export async function getConversationHistory(input: {
  accessToken: string;
  conversationId: string;
  query?: ChatHistoryQuery;
}): Promise<ChatHistoryResponse> {
  const searchParams = new URLSearchParams();

  if (input.query?.limit) {
    searchParams.set('limit', String(input.query.limit));
  }
  if (input.query?.beforeMessageId) {
    searchParams.set('beforeMessageId', input.query.beforeMessageId);
  }

  const queryString = searchParams.toString();
  return ChatHistoryResponseSchema.parse(
    await apiRequest(
      `/chat/conversations/${input.conversationId}/messages${queryString ? `?${queryString}` : ''}`,
      { method: 'GET', accessToken: input.accessToken }
    )
  );
}

const HideMessageResponseSchema = z.object({
  messageId: z.string(),
  conversationId: z.string(),
  hidden: z.boolean(),
});

export async function hideMessageForMe(messageId: string, accessToken: string) {
  return HideMessageResponseSchema.parse(
    await apiRequest(`/chat/messages/${messageId}/hide`, { method: 'POST', accessToken })
  );
}

const DeleteMessageResponseSchema = z.object({
  messageId: z.string(),
  conversationId: z.string(),
  deleted: z.boolean(),
});

export async function deleteMessageForEveryone(messageId: string, accessToken: string) {
  return DeleteMessageResponseSchema.parse(
    await apiRequest(`/chat/messages/${messageId}/delete`, { method: 'POST', accessToken })
  );
}
