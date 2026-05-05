import type {
  E2eeMessageAlgorithm,
  E2eePeerDeviceBundle,
  E2eeSenderKeyAlgorithm,
  E2eeSenderKeyEpochState,
  E2eeSenderKeyShareCiphertext,
} from "@/features/auth/auth.types"
import type {
  RoomDetail,
  RoomMember,
  RoomMembership,
  RoomSummary,
  RoomType,
} from "@/features/rooms/rooms.types"

export type ChatMemberStatus = "verified" | "limited"
export type ChatLoadState = "idle" | "loading" | "ready" | "error"
export type ChatConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"
export type ChatMessageKind = "text" | "image"
export type ChatMessageDeliveryState =
  | "sending"
  | "stored"
  | "delivered"
  | "read"
  | "rejected"

export type ChatDirectRecipient = {
  deviceId: string
  preKeyId: string
  oneTimePreKeyId: string | null
  encryptedMessageKey: string
}

export type ChatSenderKeyDistributionShare = {
  userId: string
  deviceId: string
  encryptedShare: E2eeSenderKeyShareCiphertext
}

export type ChatSenderKeyDistribution = {
  epochId: string
  algorithm: E2eeSenderKeyAlgorithm
  shares: ChatSenderKeyDistributionShare[]
}

export type ChatDirectMessageEnvelope = {
  version: "1"
  algorithm: "signal-prekey-message-v1"
  conversationType: "direct"
  senderDeviceId: string
  ciphertext: string
  nonce: string
  sentAt: string
  recipients: ChatDirectRecipient[]
}

export type ChatGroupMessageEnvelope = {
  version: "1"
  algorithm: "signal-sender-key-message-v1"
  conversationType: "group"
  senderDeviceId: string
  ciphertext: string
  nonce: string
  sentAt: string
  senderKeyEpochId: string
  distribution?: ChatSenderKeyDistribution | null
}

export type ChatCiphertextEnvelope =
  | ChatDirectMessageEnvelope
  | ChatGroupMessageEnvelope

export type ChatConversationSummary = {
  id: string
  type: RoomType
  createdBy: string
  createdAt: string
  updatedAt: string
  mutedUntil: string | null
  lastMessageId: string | null
  lastMessageAt: string | null
  lastMessageKind: ChatMessageKind | null
  lastMessageCiphertext: ChatCiphertextEnvelope | null
  directPeer: {
    userId: string
    walletAddress: string
    username: string | null
    displayName: string | null
    deviceBundles: E2eePeerDeviceBundle[]
  } | null
  groupState: {
    memberCount: number
    senderKeyState: E2eeSenderKeyEpochState | null
  } | null
}

export type ChatConversationListResponse = {
  conversations: ChatConversationSummary[]
}

export type ChatHistoryQuery = {
  limit?: number
  beforeMessageId?: string
}

export type ChatHistoryItem = {
  id: string
  conversationId: string
  senderId: string
  kind: ChatMessageKind
  ciphertext: ChatCiphertextEnvelope
  createdAt: string
  editedAt: string | null
}

export type ChatHistoryPageInfo = {
  limit: number
  hasMore: boolean
  nextBeforeMessageId: string | null
}

export type ChatHistoryResponse = {
  messages: ChatHistoryItem[]
  pageInfo: ChatHistoryPageInfo
}

export type ChatConversation = {
  id: string
  type: RoomType
  room: RoomSummary
  name: string
  description: string
  searchValue: string
  avatarSrc: string
  lastMessageAt: string | null
  lastMessageKind: ChatMessageKind | null
  lastMessagePreview: string
  lastMessagePreviewFallback: boolean
  lastActivityLabel: string
  unreadCount: number
  memberCount: number
  mutedUntil: string | null
  directPeer: ChatConversationSummary["directPeer"]
  senderKeyState: E2eeSenderKeyEpochState | null
}

export type ChatMember = {
  id: string
  name: string
  walletAddress: string
  username: string | null
  role: string
  memberRole: "admin" | "member" | null
  status: ChatMemberStatus
  avatarSrc: string
  deviceCount: number
}

export type ChatConversationContext = {
  room: RoomSummary
  membership: RoomMembership | null
  senderKeyState: E2eeSenderKeyEpochState | null
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderId: string
  kind: ChatMessageKind
  ciphertext: ChatCiphertextEnvelope
  createdAt: string
  editedAt: string | null
  previewText: string
  previewFallback: boolean
  deliveryState: ChatMessageDeliveryState
  algorithm: E2eeMessageAlgorithm
  senderDeviceId: string
  canDeleteForEveryone?: boolean
}

export type ChatSocketRequest<TData = unknown> = {
  type:
    | "ws:heartbeat:ping"
    | "chat:subscription:add"
    | "chat:subscription:remove"
    | "chat:typing:start"
    | "chat:typing:stop"
    | "chat:delivery:ack"
    | "chat:message:send"
  requestId?: string
  data: TData
}

export type ChatSocketServerFrame =
  | {
      type: "ws:connection:ready"
      requestId?: string
      data: {
        connectionId: string
        sessionId: string
        user: {
          id: string
          walletAddress: string
          role: string | null
          activeDeviceId: string
        }
      }
    }
  | {
      type: "ws:connection:error"
      requestId?: string
      data: {
        code: string
        message: string
        requestId?: string | null
        retryAfterMs?: number | null
      }
    }
  | {
      type: "ws:heartbeat:pong"
      requestId?: string
      data: {
        timestamp: string
      }
    }
  | {
      type: "chat:subscription:restored"
      requestId?: string
      data: {
        conversationIds: string[]
      }
    }
  | {
      type: "chat:subscription:added" | "chat:subscription:removed"
      requestId?: string
      data: {
        conversationId: string
        conversationType?: RoomType
      }
    }
  | {
      type: "chat:message:accepted"
      requestId?: string
      data: {
        messageId: string
        conversationId: string
        acceptedAt: string
      }
    }
  | {
      type: "chat:message:rejected"
      requestId?: string
      data: {
        code: string
        message: string
        messageId?: string | null
        conversationId?: string | null
        requestId?: string | null
        retryAfterMs?: number | null
      }
    }
  | {
      type: "chat:message:created"
      requestId?: string
      data: {
        conversationId: string
        messageId: string
        senderId: string
        kind: ChatMessageKind
        ciphertext: ChatCiphertextEnvelope
        createdAt: string
      }
    }
  | {
      type: "chat:delivery:updated"
      requestId?: string
      data: {
        messageId: string
        conversationId: string
        userId: string
        status: "delivered" | "read"
        occurredAt: string
      }
    }
  | {
      type: "chat:message:deleted"
      requestId?: string
      data: {
        conversationId: string
        id: string
      }
    }
  | {
      type: "presence:typing:started" | "presence:typing:stopped"
      requestId?: string
      data: {
        conversationId: string
        userId: string
      }
    }
  | {
      type: "presence:user:online" | "presence:user:offline"
      requestId?: string
      data: {
        conversationId: string
        userId: string
      }
    }

export type ChatRealtimeFrame = ChatSocketServerFrame

export type ChatConversationResource = {
  summary: ChatConversationSummary
  detail?: RoomDetail | null
  members?: RoomMember[]
}
