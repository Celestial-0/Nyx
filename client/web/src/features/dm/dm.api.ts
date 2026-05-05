import { apiRequest } from "@/lib/api"

import type {
  StartDirectConversationInput,
  StartDirectConversationResponse,
} from "./dm.types"

export async function startDirectConversation(
  input: StartDirectConversationInput,
  accessToken: string
): Promise<StartDirectConversationResponse> {
  return apiRequest<StartDirectConversationResponse>("/dm/start", {
    method: "POST",
    accessToken,
    body: input,
  })
}
