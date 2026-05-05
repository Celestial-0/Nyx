import { beforeEach, describe, expect, it } from "vitest"

import { useChatStore } from "./chat.store"
import type { ChatHistoryPageInfo, ChatMessage } from "./chat.types"

function message(input: Partial<ChatMessage> & Pick<ChatMessage, "id" | "createdAt">): ChatMessage {
  return {
    conversationId: "room-1",
    senderId: "user-1",
    kind: "text",
    ciphertext: {
      algorithm: "signal-prekey-message-v1",
      conversationType: "direct",
      version: "1",
      senderDeviceId: "device-1",
      nonce: "nonce",
      ciphertext: "ciphertext",
      sentAt: input.createdAt,
      recipients: [],
    },
    editedAt: null,
    previewText: "Encrypted message",
    previewFallback: true,
    deliveryState: "stored",
    algorithm: "signal-prekey-message-v1",
    senderDeviceId: "device-1",
    ...input,
  }
}

const pageInfo: ChatHistoryPageInfo = {
  limit: 2,
  hasMore: true,
  nextBeforeMessageId: "older-1",
}

describe("chat store history", () => {
  beforeEach(() => {
    useChatStore.getState().reset()
  })

  it("stores page info with the initial history page", () => {
    useChatStore
      .getState()
      .setMessages(
        "room-1",
        [
          message({ id: "newer", createdAt: "2026-01-01T00:02:00.000Z" }),
          message({ id: "older", createdAt: "2026-01-01T00:01:00.000Z" }),
        ],
        pageInfo
      )

    const state = useChatStore.getState()
    expect(state.messagesByConversation["room-1"].map((item) => item.id)).toEqual([
      "older",
      "newer",
    ])
    expect(state.historyPageInfoByConversation["room-1"]).toEqual(pageInfo)
  })

  it("prepends older messages without duplicating existing ids", () => {
    useChatStore.getState().setMessages("room-1", [
      message({ id: "middle", createdAt: "2026-01-01T00:02:00.000Z" }),
      message({ id: "newest", createdAt: "2026-01-01T00:03:00.000Z" }),
    ])

    useChatStore.getState().prependMessages(
      "room-1",
      [
        message({ id: "oldest", createdAt: "2026-01-01T00:01:00.000Z" }),
        message({ id: "middle", createdAt: "2026-01-01T00:02:00.000Z" }),
      ],
      {
        limit: 2,
        hasMore: false,
        nextBeforeMessageId: null,
      }
    )

    const state = useChatStore.getState()
    expect(state.messagesByConversation["room-1"].map((item) => item.id)).toEqual([
      "oldest",
      "middle",
      "newest",
    ])
    expect(
      state.historyPageInfoByConversation["room-1"].nextBeforeMessageId
    ).toBeNull()
  })
})
