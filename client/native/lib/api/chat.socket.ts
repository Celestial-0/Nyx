import { decryptConversationEnvelope, getStoredLocalAuthDevice } from '@/lib/e2ee';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import type {
  ChatCiphertextEnvelope,
  ChatMessage,
  ChatMessageKind,
  ChatRealtimeFrame,
  ChatSocketRequest,
} from '@/types';

import { API_BASE_URL } from '../env';
import { createWebSocketClient } from './socket';

/**
 * Chat realtime layer. Ported from the web client's `features/chat/chat.ws.ts`,
 * including real per-message preview decryption via the E2EE service.
 */

function encryptedPreview(kind: ChatMessageKind | null): string {
  return kind === 'image' ? 'Encrypted image payload' : 'Encrypted message';
}

/** Decrypt an incoming realtime message for its list/preview text. */
function getRealtimePreview(input: {
  conversationId: string;
  senderId: string;
  kind: ChatMessageKind;
  ciphertext: ChatCiphertextEnvelope;
}): { text: string; isPlaceholder: boolean } {
  const authUser = useAuthStore.getState().user;
  const chat = useChatStore.getState();

  if (!authUser) {
    return { text: encryptedPreview(input.kind), isPlaceholder: true };
  }

  const conversation = chat.conversations.find((item) => item.id === input.conversationId);
  const localDevice = getStoredLocalAuthDevice(authUser.walletAddress);

  if (!conversation) {
    return { text: encryptedPreview(input.kind), isPlaceholder: true };
  }

  const decrypted = decryptConversationEnvelope({
    envelope: input.ciphertext,
    kind: input.kind,
    currentUserId: authUser.id,
    walletAddress: authUser.walletAddress,
    localDevice,
    peerDeviceBundles: conversation.directPeer?.deviceBundles ?? [],
    members: chat.roomMembersByConversation[input.conversationId] ?? [],
    senderKeyState:
      chat.contextByConversation[input.conversationId]?.senderKeyState ??
      conversation.senderKeyState,
    senderId: input.senderId,
  });

  return { text: decrypted.text, isPlaceholder: decrypted.isPlaceholder };
}

function toWebSocketUrl(baseUrl: string): string {
  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace('https://', 'wss://');
  }
  if (baseUrl.startsWith('http://')) {
    return baseUrl.replace('http://', 'ws://');
  }
  return baseUrl;
}

function parseFrame(rawMessage: string): ChatRealtimeFrame | null {
  try {
    const parsed = JSON.parse(rawMessage) as {
      type?: string;
      requestId?: string;
      data?: unknown;
    };

    if (!parsed.type || typeof parsed.type !== 'string') {
      return null;
    }

    return { type: parsed.type, requestId: parsed.requestId, data: parsed.data };
  } catch {
    return null;
  }
}

export function createChatSocketClient(accessToken: string, sharePresence = true) {
  const websocketBaseUrl = toWebSocketUrl(API_BASE_URL);
  const url = `${websocketBaseUrl}/ws?token=${encodeURIComponent(accessToken)}&sharePresence=${sharePresence}`;

  return createWebSocketClient<ChatRealtimeFrame, ChatSocketRequest>({
    url,
    parseMessage: parseFrame,
    onStatusChange: (status) => {
      const chat = useChatStore.getState();
      switch (status) {
        case 'connecting':
          chat.setConnectionState('connecting');
          return;
        case 'connected':
          chat.setConnectionState('connected');
          chat.setRealtimeError(null);
          return;
        case 'disconnected':
          chat.setConnectionState('disconnected');
          return;
        case 'error':
          chat.setConnectionState('error');
          return;
      }
    },
  });
}

/** Narrow the permissive frame `data` per event type and apply it to the store. */
export function handleChatRealtimeEvent(frame: ChatRealtimeFrame): void {
  const chat = useChatStore.getState();
  const currentUserId = useAuthStore.getState().user?.id ?? null;
  const data = frame.data as Record<string, any> | undefined;

  switch (frame.type) {
    case 'ws:connection:ready':
      chat.setConnectionState('connected');
      chat.setRealtimeError(null);
      return;

    case 'ws:connection:error':
      chat.setConnectionState('error');
      chat.setRealtimeError(data?.message ?? 'Realtime connection error');
      return;

    case 'chat:subscription:restored':
      chat.setSubscribedConversationIds(data?.conversationIds ?? []);
      return;

    case 'chat:subscription:added':
      chat.setSubscribedConversationIds(
        Array.from(new Set([...chat.subscribedConversationIds, data?.conversationId]))
      );
      return;

    case 'chat:subscription:removed':
      chat.setSubscribedConversationIds(
        chat.subscribedConversationIds.filter((id) => id !== data?.conversationId)
      );
      return;

    case 'chat:message:created': {
      const preview = getRealtimePreview({
        conversationId: data?.conversationId,
        senderId: data?.senderId,
        kind: data?.kind,
        ciphertext: data?.ciphertext,
      });
      const message: ChatMessage = {
        id: data?.messageId,
        conversationId: data?.conversationId,
        senderId: data?.senderId,
        kind: data?.kind,
        ciphertext: data?.ciphertext,
        createdAt: data?.createdAt,
        editedAt: null,
        previewText: preview.text,
        previewFallback: preview.isPlaceholder,
        deliveryState: data?.senderId === currentUserId ? 'stored' : 'delivered',
        algorithm: data?.ciphertext?.algorithm,
        senderDeviceId: data?.ciphertext?.senderDeviceId,
        canDeleteForEveryone: data?.senderId === currentUserId,
      };
      chat.appendRealtimeMessage({
        message,
        isOwnMessage: data?.senderId === currentUserId,
        markUnread:
          data?.conversationId !== chat.activeConversationId &&
          data?.senderId !== currentUserId,
      });
      return;
    }

    case 'chat:message:accepted':
      chat.updateDeliveryState(data?.conversationId, data?.messageId, 'stored');
      return;

    case 'chat:message:rejected':
      if (data?.conversationId && data?.messageId) {
        chat.updateDeliveryState(data.conversationId, data.messageId, 'rejected');
      }
      chat.setRealtimeError(data?.message ?? 'Message rejected');
      return;

    case 'chat:delivery:updated':
      chat.updateDeliveryState(data?.conversationId, data?.messageId, data?.status);
      return;

    case 'chat:message:deleted':
      chat.removeMessage(data?.conversationId, data?.id);
      return;

    case 'presence:typing:started':
      if (data?.userId !== currentUserId) {
        chat.setTypingPresence(data?.conversationId, data?.userId, true);
      }
      return;

    case 'presence:typing:stopped':
      chat.setTypingPresence(data?.conversationId, data?.userId, false);
      return;

    case 'presence:user:online':
      chat.setUserOnlineStatus(data?.userId, true);
      return;

    case 'presence:user:offline':
      chat.setUserOnlineStatus(data?.userId, false);
      return;

    case 'ws:heartbeat:pong':
      return;
  }
}
