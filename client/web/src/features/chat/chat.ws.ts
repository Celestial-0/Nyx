import { useAuthStore } from "@/features/auth/auth.store"
import {
  decryptConversationEnvelope,
  getStoredLocalAuthDevice,
} from "@/features/e2ee/e2ee.service"
import { openPaymentsPanelAction } from "@/features/payments/payments.hooks"
import { API_BASE_URL } from "@/lib/api"
import { createWebSocketClient } from "@/lib/socket"

import { useChatStore } from "./chat.store"
import type {
  ChatMessage,
  ChatRealtimeFrame,
  ChatSocketRequest,
} from "./chat.types"

function toWebSocketUrl(baseUrl: string) {
  if (baseUrl.startsWith("https://")) {
    return baseUrl.replace("https://", "wss://")
  }

  if (baseUrl.startsWith("http://")) {
    return baseUrl.replace("http://", "ws://")
  }

  return baseUrl
}

function encryptedPreview(kind: ChatMessage["kind"]) {
  return kind === "image" ? "Encrypted image payload" : "Encrypted message"
}

function getRealtimePreview(input: {
  conversationId: string
  senderId: string
  kind: ChatMessage["kind"]
  ciphertext: ChatMessage["ciphertext"]
}) {
  const authUser = useAuthStore.getState().user
  const chat = useChatStore.getState()

  if (!authUser) {
    return {
      text: encryptedPreview(input.kind),
      isPlaceholder: true,
    }
  }

  const conversation = chat.conversations.find(
    (item) => item.id === input.conversationId
  )
  const localDevice = getStoredLocalAuthDevice(authUser.walletAddress)

  if (!conversation) {
    return {
      text: encryptedPreview(input.kind),
      isPlaceholder: true,
    }
  }

  return decryptConversationEnvelope({
    envelope: input.ciphertext,
    kind: input.kind,
    currentUserId: authUser.id,
    walletAddress: authUser.walletAddress,
    localDevice,
    peerDeviceBundles: conversation.directPeer?.deviceBundles ?? [],
    members:
      chat.roomMembersByConversation[input.conversationId] ?? [],
    senderKeyState:
      chat.contextByConversation[input.conversationId]?.senderKeyState ??
      conversation.senderKeyState,
    senderId: input.senderId,
  })
}

function parseFrame(rawMessage: string): ChatRealtimeFrame | null {
  try {
    const parsed = JSON.parse(rawMessage) as {
      type?: string
      requestId?: string
      data?: unknown
    }

    if (!parsed.type || typeof parsed.type !== "string") {
      return null
    }

    return {
      type: parsed.type,
      requestId: parsed.requestId,
      data: parsed.data,
    } as ChatRealtimeFrame
  } catch {
    return null
  }
}

export function createChatSocketClient(
  accessToken: string,
  sharePresence: boolean = true
) {
  const websocketBaseUrl = toWebSocketUrl(API_BASE_URL)
  const url = `${websocketBaseUrl}/ws?token=${encodeURIComponent(accessToken)}&sharePresence=${sharePresence}`

  return createWebSocketClient<ChatRealtimeFrame, ChatSocketRequest>({
    url,
    parseMessage: parseFrame,
    onStatusChange: (status) => {
      const chat = useChatStore.getState()

      switch (status) {
        case "connecting":
          chat.setConnectionState("connecting")
          return
        case "connected":
          chat.setConnectionState("connected")
          chat.setRealtimeError(null)
          return
        case "disconnected":
          chat.setConnectionState("disconnected")
          return
        case "error":
          chat.setConnectionState("error")
          return
      }
    },
  })
}

export function handleChatRealtimeEvent(frame: ChatRealtimeFrame) {
  const chat = useChatStore.getState()
  const currentUserId = useAuthStore.getState().user?.id ?? null

  switch (frame.type) {
    case "ws:connection:ready":
      chat.setConnectionState("connected")
      chat.setRealtimeError(null)
      return

    case "ws:connection:error":
      chat.setConnectionState("error")
      chat.setRealtimeError(frame.data.message)
      return

    case "chat:subscription:restored":
      chat.setSubscribedConversationIds(frame.data.conversationIds)
      return

    case "chat:subscription:added":
      chat.setSubscribedConversationIds(
        Array.from(
          new Set([
            ...chat.subscribedConversationIds,
            frame.data.conversationId,
          ])
        )
      )
      return

    case "chat:subscription:removed":
      chat.setSubscribedConversationIds(
        chat.subscribedConversationIds.filter(
          (conversationId) => conversationId !== frame.data.conversationId
        )
      )
      return

    case "chat:message:created": {
      const preview = getRealtimePreview({
        conversationId: frame.data.conversationId,
        senderId: frame.data.senderId,
        kind: frame.data.kind,
        ciphertext: frame.data.ciphertext,
      })
      chat.appendRealtimeMessage({
        message: {
          id: frame.data.messageId,
          conversationId: frame.data.conversationId,
          senderId: frame.data.senderId,
          kind: frame.data.kind,
          ciphertext: frame.data.ciphertext,
          createdAt: frame.data.createdAt,
          editedAt: null,
          previewText: preview.text,
          previewFallback: preview.isPlaceholder,
          deliveryState:
            frame.data.senderId === currentUserId ? "stored" : "delivered",
          algorithm: frame.data.ciphertext.algorithm,
          senderDeviceId: frame.data.ciphertext.senderDeviceId,
          canDeleteForEveryone: frame.data.senderId === currentUserId,
        },
        isOwnMessage: frame.data.senderId === currentUserId,
        markUnread:
          frame.data.conversationId !== chat.activeConversationId &&
          frame.data.senderId !== currentUserId,
      })
      return
    }

    case "chat:message:accepted":
      chat.updateDeliveryState(
        frame.data.conversationId,
        frame.data.messageId,
        "stored"
      )
      return

    case "chat:message:rejected":
      if (frame.data.conversationId && frame.data.messageId) {
        chat.updateDeliveryState(
          frame.data.conversationId,
          frame.data.messageId,
          "rejected"
        )
      }
      if (frame.data.code === "INSUFFICIENT_CREDITS") {
        openPaymentsPanelAction({
          source: "message-send",
          recoveryMessage:
            "Add credits to keep sending encrypted messages in this conversation.",
        })
      }
      chat.setRealtimeError(frame.data.message)
      return

    case "chat:delivery:updated":
      chat.updateDeliveryState(
        frame.data.conversationId,
        frame.data.messageId,
        frame.data.status
      )
      return

    case "chat:message:deleted":
      chat.removeMessage(frame.data.conversationId, frame.data.id)
      return

    case "presence:typing:started":
      if (frame.data.userId !== currentUserId) {
        chat.setTypingPresence(
          frame.data.conversationId,
          frame.data.userId,
          true
        )
      }
      return

    case "presence:typing:stopped":
      chat.setTypingPresence(
        frame.data.conversationId,
        frame.data.userId,
        false
      )
      return

    case "presence:user:online":
      chat.setUserOnlineStatus(frame.data.userId, true)
      return

    case "presence:user:offline":
      chat.setUserOnlineStatus(frame.data.userId, false)
      return

    case "ws:heartbeat:pong":
      return
  }
}
