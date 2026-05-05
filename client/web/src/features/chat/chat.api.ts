import { apiRequest } from "@/lib/api"

import type {
  ChatConversationListResponse,
  ChatHistoryQuery,
  ChatHistoryResponse,
} from "./chat.types"

export async function getConversationList(
  accessToken: string
): Promise<ChatConversationListResponse> {
  return apiRequest<ChatConversationListResponse>("/chat/conversations", {
    method: "GET",
    accessToken,
  })
}

export async function getConversationHistory(input: {
  accessToken: string
  conversationId: string
  query?: ChatHistoryQuery
}): Promise<ChatHistoryResponse> {
  const searchParams = new URLSearchParams()

  if (input.query?.limit) {
    searchParams.set("limit", String(input.query.limit))
  }

  if (input.query?.beforeMessageId) {
    searchParams.set("beforeMessageId", input.query.beforeMessageId)
  }

  const queryString = searchParams.toString()
  return apiRequest<ChatHistoryResponse>(
    `/chat/conversations/${input.conversationId}/messages${
      queryString ? `?${queryString}` : ""
    }`,
    {
      method: "GET",
      accessToken: input.accessToken,
    }
  )
}

export async function hideMessageForMe(
  messageId: string,
  accessToken: string
): Promise<{ messageId: string; conversationId: string; hidden: boolean }> {
  return apiRequest<{
    messageId: string
    conversationId: string
    hidden: boolean
  }>(`/chat/messages/${messageId}/hide`, {
    method: "POST",
    accessToken,
  })
}

export async function deleteMessageForEveryone(
  messageId: string,
  accessToken: string
): Promise<{ messageId: string; conversationId: string; deleted: boolean }> {
  return apiRequest<{
    messageId: string
    conversationId: string
    deleted: boolean
  }>(`/chat/messages/${messageId}/delete`, {
    method: "POST",
    accessToken,
  })
}
