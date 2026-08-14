import { useCallback, useEffect, useMemo } from 'react';

import { createChatSocketClient, handleChatRealtimeEvent } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { useUserStore } from '@/store/user.store';
import type { ChatSocketRequest } from '@/types';

import { useSocket } from './useSocket';

/**
 * Establishes and maintains the chat WebSocket: heartbeat, subscription sync,
 * and realtime-sender registration. Ported from the web client's
 * `useChatRealtime` (`features/chat/chat.hooks.ts`), `window.*` → RN globals.
 */
export function useChatRealtime() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const authStatus = useAuthStore((state) => state.status);
  const connectionState = useChatStore((state) => state.connectionState);
  const conversations = useChatStore((state) => state.conversations);
  const sharePresence = useUserStore((state) => state.config.sharePresence);
  const subscribedConversationIds = useChatStore((state) => state.subscribedConversationIds);
  const setRealtimeSender = useChatStore((state) => state.setRealtimeSender);
  const setConnectionState = useChatStore((state) => state.setConnectionState);

  const conversationIds = useMemo(
    () => conversations.map((conversation) => conversation.id),
    [conversations]
  );

  const createClient = useCallback(
    () => createChatSocketClient(accessToken ?? '', sharePresence),
    [accessToken, sharePresence]
  );

  const handleDispose = useCallback(() => {
    setConnectionState('disconnected');
    setRealtimeSender(null);
  }, [setConnectionState, setRealtimeSender]);

  const { send } = useSocket({
    enabled: authStatus === 'authenticated' && Boolean(accessToken),
    createClient,
    onEvent: handleChatRealtimeEvent,
    onDispose: handleDispose,
  });

  useEffect(() => {
    setRealtimeSender(send);
    return () => setRealtimeSender(null);
  }, [send, setRealtimeSender]);

  useEffect(() => {
    if (connectionState !== 'connected') {
      return;
    }

    const intervalId = setInterval(() => {
      send({ type: 'ws:heartbeat:ping', data: {} } satisfies ChatSocketRequest<
        Record<string, never>
      >);
    }, 25_000);

    return () => clearInterval(intervalId);
  }, [connectionState, send]);

  useEffect(() => {
    if (connectionState !== 'connected' || !conversationIds.length) {
      return;
    }

    const missingConversationIds = conversationIds.filter(
      (conversationId) => !subscribedConversationIds.includes(conversationId)
    );

    for (const conversationId of missingConversationIds) {
      send({ type: 'chat:subscription:add', data: { conversationId } });
    }

    const staleConversationIds = subscribedConversationIds.filter(
      (conversationId) => !conversationIds.includes(conversationId)
    );

    for (const conversationId of staleConversationIds) {
      send({ type: 'chat:subscription:remove', data: { conversationId } });
    }
  }, [connectionState, conversationIds, send, subscribedConversationIds]);
}
