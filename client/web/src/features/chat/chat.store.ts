import { create } from "zustand"
import type { RoomMember } from "@/features/rooms/rooms.types"

import type {
  ChatConnectionState,
  ChatConversation,
  ChatConversationContext,
  ChatLoadState,
  ChatSocketRequest,
  ChatMessage,
  ChatMessageKind,
  ChatMember,
  ChatHistoryPageInfo,
} from "./chat.types"

function formatRelativeLabel(value: string | null) {
  if (!value) {
    return "No activity yet"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Recently"
  }

  const diffMinutes = Math.max(
    1,
    Math.round((Date.now() - date.getTime()) / 60_000)
  )

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}

function encryptedPreview(kind: ChatMessageKind | null) {
  if (kind === "image") {
    return "Encrypted image payload"
  }

  return "Encrypted message"
}

function sortConversations(conversations: ChatConversation[]) {
  return [...conversations].sort((left, right) => {
    const leftTimestamp = left.lastMessageAt ?? left.room.updatedAt
    const rightTimestamp = right.lastMessageAt ?? right.room.updatedAt

    return (
      new Date(rightTimestamp).getTime() - new Date(leftTimestamp).getTime()
    )
  })
}

type ConversationScopedState<T> = Record<string, T>

type ChatState = {
  conversations: ChatConversation[]
  conversationsState: ChatLoadState
  conversationsError: string | null
  activeConversationId: string | null
  searchQuery: string
  draftMessage: string
  messagesByConversation: ConversationScopedState<ChatMessage[]>
  historyPageInfoByConversation: ConversationScopedState<ChatHistoryPageInfo>
  historyStateByConversation: ConversationScopedState<ChatLoadState>
  olderHistoryStateByConversation: ConversationScopedState<ChatLoadState>
  historyErrorByConversation: ConversationScopedState<string | null>
  membersByConversation: ConversationScopedState<ChatMember[]>
  roomMembersByConversation: ConversationScopedState<RoomMember[]>
  contextByConversation: ConversationScopedState<ChatConversationContext | null>
  detailsStateByConversation: ConversationScopedState<ChatLoadState>
  detailsErrorByConversation: ConversationScopedState<string | null>
  typingByConversation: ConversationScopedState<string[]>
  isChatListOpen: boolean
  isInfoPanelOpen: boolean
  connectionState: ChatConnectionState
  subscribedConversationIds: string[]
  onlineUserIds: Set<string>
  realtimeError: string | null
  composerLocked: boolean
  composerNotice: string | null
  sendRealtime: ((payload: ChatSocketRequest) => boolean) | null
}

type ChatActions = {
  reset: () => void
  setConversationsState: (value: ChatLoadState) => void
  setConversationsError: (value: string | null) => void
  setConversations: (conversations: ChatConversation[]) => void
  patchConversation: (
    conversationId: string,
    patch: Partial<ChatConversation>
  ) => void
  selectConversation: (conversationId: string) => void
  setSearchQuery: (value: string) => void
  setDraftMessage: (value: string) => void
  setMessages: (
    conversationId: string,
    messages: ChatMessage[],
    pageInfo?: ChatHistoryPageInfo
  ) => void
  prependMessages: (
    conversationId: string,
    messages: ChatMessage[],
    pageInfo: ChatHistoryPageInfo
  ) => void
  setHistoryState: (conversationId: string, value: ChatLoadState) => void
  setOlderHistoryState: (conversationId: string, value: ChatLoadState) => void
  setHistoryError: (conversationId: string, value: string | null) => void
  setMembers: (conversationId: string, members: ChatMember[]) => void
  setRoomMembers: (conversationId: string, members: RoomMember[]) => void
  setContext: (
    conversationId: string,
    context: ChatConversationContext | null
  ) => void
  setDetailsState: (conversationId: string, value: ChatLoadState) => void
  setDetailsError: (conversationId: string, value: string | null) => void
  appendRealtimeMessage: (input: {
    message: ChatMessage
    isOwnMessage: boolean
    markUnread: boolean
  }) => void
  updateDeliveryState: (
    conversationId: string,
    messageId: string,
    deliveryState: ChatMessage["deliveryState"]
  ) => void
  mapConversationMessages: (
    conversationId: string,
    mapper: (message: ChatMessage) => ChatMessage
  ) => void
  setTypingPresence: (
    conversationId: string,
    userId: string,
    isTyping: boolean
  ) => void
  setChatListOpen: (value: boolean) => void
  setInfoPanelOpen: (value: boolean) => void
  setConnectionState: (value: ChatConnectionState) => void
  setSubscribedConversationIds: (value: string[]) => void
  setRealtimeError: (value: string | null) => void
  setUserOnlineStatus: (userId: string, isOnline: boolean) => void
  setComposerState: (input: {
    locked: boolean
    notice: string | null
  }) => void
  setRealtimeSender: (
    value: ((payload: ChatSocketRequest) => boolean) | null
  ) => void
  removeConversation: (conversationId: string) => void
  removeMessage: (conversationId: string, messageId: string) => void
}

export type ChatStore = ChatState & ChatActions
export const SELF_MEMBER_ID = "self"

const initialState: ChatState = {
  conversations: [],
  conversationsState: "idle",
  conversationsError: null,
  activeConversationId: null,
  searchQuery: "",
  draftMessage: "",
  messagesByConversation: {},
  historyPageInfoByConversation: {},
  historyStateByConversation: {},
  olderHistoryStateByConversation: {},
  historyErrorByConversation: {},
  membersByConversation: {},
  roomMembersByConversation: {},
  contextByConversation: {},
  detailsStateByConversation: {},
  detailsErrorByConversation: {},
  typingByConversation: {},
  isChatListOpen: false,
  isInfoPanelOpen: false,
  connectionState: "idle",
  subscribedConversationIds: [],
  onlineUserIds: new Set<string>(),
  realtimeError: null,
  composerLocked: true,
  composerNotice: null,
  sendRealtime: null,
}

export const useChatStore = create<ChatStore>((set) => ({
  ...initialState,

  reset: () =>
    set({
      ...initialState,
    }),

  setConversationsState: (conversationsState) => set({ conversationsState }),
  setConversationsError: (conversationsError) => set({ conversationsError }),

  setConversations: (conversations) =>
    set((state) => {
      const unreadById = new Map(
        state.conversations.map((conversation) => [
          conversation.id,
          conversation.unreadCount,
        ])
      )

      const nextConversations = sortConversations(
        conversations.map((conversation) => ({
          ...conversation,
          unreadCount:
            unreadById.get(conversation.id) ?? conversation.unreadCount,
          lastMessagePreview:
            conversation.lastMessagePreview ||
            encryptedPreview(conversation.lastMessageKind),
          lastMessagePreviewFallback:
            conversation.lastMessagePreviewFallback ??
            !conversation.lastMessagePreview,
          lastActivityLabel:
            conversation.lastActivityLabel ||
            formatRelativeLabel(conversation.lastMessageAt),
        }))
      )

      const activeConversationId =
        nextConversations.find(
          (conversation) => conversation.id === state.activeConversationId
        )?.id ??
        nextConversations[0]?.id ??
        null

      return {
        conversations: nextConversations,
        conversationsState: "ready",
        conversationsError: null,
        activeConversationId,
      }
    }),

  patchConversation: (conversationId, patch) =>
    set((state) => ({
      conversations: sortConversations(
        state.conversations.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                ...patch,
                lastMessagePreviewFallback:
                  patch.lastMessagePreviewFallback ??
                  conversation.lastMessagePreviewFallback,
                lastActivityLabel:
                  patch.lastActivityLabel ??
                  formatRelativeLabel(
                    patch.lastMessageAt ?? conversation.lastMessageAt
                  ),
              }
            : conversation
        )
      ),
    })),

  selectConversation: (conversationId) =>
    set((state) => ({
      activeConversationId: conversationId,
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      ),
      isChatListOpen: false,
    })),

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setDraftMessage: (draftMessage) => set({ draftMessage }),

  setMessages: (conversationId, messages, pageInfo) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [...messages].sort(
          (left, right) =>
            new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime()
        ),
      },
      historyPageInfoByConversation: pageInfo
        ? {
            ...state.historyPageInfoByConversation,
            [conversationId]: pageInfo,
          }
        : state.historyPageInfoByConversation,
      historyStateByConversation: {
        ...state.historyStateByConversation,
        [conversationId]: "ready",
      },
      historyErrorByConversation: {
        ...state.historyErrorByConversation,
        [conversationId]: null,
      },
    })),

  prependMessages: (conversationId, messages, pageInfo) =>
    set((state) => {
      const existingMessages = state.messagesByConversation[conversationId] ?? []
      const byId = new Map<string, ChatMessage>()

      for (const message of [...messages, ...existingMessages]) {
        byId.set(message.id, message)
      }

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: Array.from(byId.values()).sort(
            (left, right) =>
              new Date(left.createdAt).getTime() -
              new Date(right.createdAt).getTime()
          ),
        },
        historyPageInfoByConversation: {
          ...state.historyPageInfoByConversation,
          [conversationId]: pageInfo,
        },
        olderHistoryStateByConversation: {
          ...state.olderHistoryStateByConversation,
          [conversationId]: "ready",
        },
        historyErrorByConversation: {
          ...state.historyErrorByConversation,
          [conversationId]: null,
        },
      }
    }),

  setHistoryState: (conversationId, value) =>
    set((state) => ({
      historyStateByConversation: {
        ...state.historyStateByConversation,
        [conversationId]: value,
      },
    })),

  setOlderHistoryState: (conversationId, value) =>
    set((state) => ({
      olderHistoryStateByConversation: {
        ...state.olderHistoryStateByConversation,
        [conversationId]: value,
      },
    })),

  setHistoryError: (conversationId, value) =>
    set((state) => ({
      historyErrorByConversation: {
        ...state.historyErrorByConversation,
        [conversationId]: value,
      },
    })),

  setMembers: (conversationId, members) =>
    set((state) => ({
      membersByConversation: {
        ...state.membersByConversation,
        [conversationId]: members,
      },
    })),

  setRoomMembers: (conversationId, members) =>
    set((state) => ({
      roomMembersByConversation: {
        ...state.roomMembersByConversation,
        [conversationId]: members,
      },
    })),

  setContext: (conversationId, context) =>
    set((state) => ({
      contextByConversation: {
        ...state.contextByConversation,
        [conversationId]: context,
      },
      detailsStateByConversation: {
        ...state.detailsStateByConversation,
        [conversationId]: "ready",
      },
      detailsErrorByConversation: {
        ...state.detailsErrorByConversation,
        [conversationId]: null,
      },
    })),

  setDetailsState: (conversationId, value) =>
    set((state) => ({
      detailsStateByConversation: {
        ...state.detailsStateByConversation,
        [conversationId]: value,
      },
    })),

  setDetailsError: (conversationId, value) =>
    set((state) => ({
      detailsErrorByConversation: {
        ...state.detailsErrorByConversation,
        [conversationId]: value,
      },
    })),

  appendRealtimeMessage: ({ message, isOwnMessage, markUnread }) =>
    set((state) => {
      const existingMessages =
        state.messagesByConversation[message.conversationId] ?? []
      const alreadyStored = existingMessages.some((existingMessage) => existingMessage.id === message.id)
      const nextMessages = alreadyStored
        ? existingMessages
            .map((existingMessage) =>
              existingMessage.id === message.id
                ? {
                    ...existingMessage,
                    ...message,
                  }
                : existingMessage
            )
            .sort(
              (left, right) =>
                new Date(left.createdAt).getTime() -
                new Date(right.createdAt).getTime()
            )
        : [...existingMessages, message].sort(
            (left, right) =>
              new Date(left.createdAt).getTime() -
              new Date(right.createdAt).getTime()
          )

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [message.conversationId]: nextMessages,
        },
        typingByConversation: {
          ...state.typingByConversation,
          [message.conversationId]: [],
        },
        conversations: sortConversations(
          state.conversations.map((conversation) =>
            conversation.id === message.conversationId
              ? {
                  ...conversation,
                  lastMessageAt: message.createdAt,
                  lastMessageKind: message.kind,
                  lastMessagePreview: message.previewText,
                  lastMessagePreviewFallback: message.previewFallback,
                  lastActivityLabel: formatRelativeLabel(message.createdAt),
                  unreadCount:
                    isOwnMessage || !markUnread
                      ? 0
                      : conversation.unreadCount + 1,
                }
              : conversation
          )
        ),
      }
    }),

  updateDeliveryState: (conversationId, messageId, deliveryState) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (
          state.messagesByConversation[conversationId] ?? []
        ).map((message) =>
          message.id === messageId ? { ...message, deliveryState } : message
        ),
      },
    })),

  mapConversationMessages: (conversationId, mapper) =>
    set((state) => {
      const nextMessages = (state.messagesByConversation[conversationId] ?? []).map(mapper)
      const latestMessage = nextMessages.at(-1) ?? null

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: nextMessages,
        },
        conversations: latestMessage
          ? sortConversations(
              state.conversations.map((conversation) =>
                conversation.id === conversationId
                  ? {
                      ...conversation,
                      lastMessagePreview: latestMessage.previewText,
                      lastMessagePreviewFallback: latestMessage.previewFallback,
                    }
                  : conversation
              )
            )
          : state.conversations,
      }
    }),

  setTypingPresence: (conversationId, userId, isTyping) =>
    set((state) => {
      const currentUsers = state.typingByConversation[conversationId] ?? []
      const nextUsers = isTyping
        ? Array.from(new Set([...currentUsers, userId]))
        : currentUsers.filter((currentUserId) => currentUserId !== userId)

      return {
        typingByConversation: {
          ...state.typingByConversation,
          [conversationId]: nextUsers,
        },
      }
    }),

  setChatListOpen: (isChatListOpen) => set({ isChatListOpen }),
  setInfoPanelOpen: (isInfoPanelOpen) => set({ isInfoPanelOpen }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setSubscribedConversationIds: (subscribedConversationIds) =>
    set({ subscribedConversationIds }),
  setRealtimeError: (realtimeError) => set({ realtimeError }),
  setComposerState: ({ locked, notice }) =>
    set({
      composerLocked: locked,
      composerNotice: notice,
    }),
  setRealtimeSender: (sendRealtime) => set({ sendRealtime }),
  setUserOnlineStatus: (userId, isOnline) =>
    set((state) => {
      const next = new Set(state.onlineUserIds)
      if (isOnline) {
        next.add(userId)
      } else {
        next.delete(userId)
      }
      return { onlineUserIds: next }
    }),

  removeConversation: (conversationId) =>
    set((state) => {
      const nextConversations = state.conversations.filter(
        (conversation) => conversation.id !== conversationId
      )
      const nextActiveConversationId =
        state.activeConversationId === conversationId
          ? nextConversations[0]?.id ?? null
          : state.activeConversationId

      const { [conversationId]: _messages, ...messagesByConversation } =
        state.messagesByConversation
      const { [conversationId]: _pageInfo, ...historyPageInfoByConversation } =
        state.historyPageInfoByConversation
      const { [conversationId]: _historyState, ...historyStateByConversation } =
        state.historyStateByConversation
      const {
        [conversationId]: _olderHistoryState,
        ...olderHistoryStateByConversation
      } = state.olderHistoryStateByConversation
      const { [conversationId]: _historyError, ...historyErrorByConversation } =
        state.historyErrorByConversation
      const { [conversationId]: _members, ...membersByConversation } =
        state.membersByConversation
      const { [conversationId]: _roomMembers, ...roomMembersByConversation } =
        state.roomMembersByConversation
      const { [conversationId]: _context, ...contextByConversation } =
        state.contextByConversation
      const { [conversationId]: _detailsState, ...detailsStateByConversation } =
        state.detailsStateByConversation
      const { [conversationId]: _detailsError, ...detailsErrorByConversation } =
        state.detailsErrorByConversation
      const { [conversationId]: _typing, ...typingByConversation } =
        state.typingByConversation

      return {
        conversations: nextConversations,
        activeConversationId: nextActiveConversationId,
        messagesByConversation,
        historyPageInfoByConversation,
        historyStateByConversation,
        olderHistoryStateByConversation,
        historyErrorByConversation,
        membersByConversation,
        roomMembersByConversation,
        contextByConversation,
        detailsStateByConversation,
        detailsErrorByConversation,
        typingByConversation,
      }
    }),

  removeMessage: (conversationId, messageId) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (state.messagesByConversation[conversationId] ?? []).filter(
          (message) => message.id !== messageId
        ),
      },
    })),
}))
