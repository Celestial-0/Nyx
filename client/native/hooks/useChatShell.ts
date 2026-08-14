import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { ApiRequestError } from '@/lib/api';
import {
  createGroupConversationAction,
  joinGroupConversationAction,
  leaveGroupConversationAction,
  loadContactsAction,
  loadConversationDetailsAction,
  loadConversationHistoryAction,
  loadOlderConversationHistoryAction,
  loadConversationListAction,
  refreshConversationStateAction,
  searchDirectoryUsersAction,
  sendEncryptedMessageAction,
  startDirectConversationAction,
  syncComposerForConversation,
} from '@/lib/chat/chat.actions';
import { loadPaymentsSnapshotAction, openPaymentsPanelAction } from '@/hooks/usePayments';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { useContactsStore } from '@/store/contacts.store';
import { useUserStore } from '@/store/user.store';
import type { ChatSocketRequest } from '@/types';

import { useCurrentUser } from './useUserProfile';

function getShortWallet(walletAddress: string) {
  return `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
}

/**
 * The master chat screen hook. Ported from the web client's `useChatShell`
 * (`features/chat/chat.hooks.ts`). RN adaptations: `AppState` replaces
 * `document.visibilityState`/focus listeners; `window.*` timers → globals; the
 * responsive-panel logic is dropped (mobile is always single-pane).
 */
export function useChatShell() {
  const authStatus = useAuthStore((state) => state.status);
  const currentUser = useAuthStore((state) => state.user);
  const profile = useCurrentUser();
  const contactsStatus = useContactsStore((state) => state.status);
  const resetContacts = useContactsStore((state) => state.reset);

  const conversations = useChatStore((state) => state.conversations);
  const conversationsState = useChatStore((state) => state.conversationsState);
  const conversationsError = useChatStore((state) => state.conversationsError);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const messagesByConversation = useChatStore((state) => state.messagesByConversation);
  const historyStateByConversation = useChatStore((state) => state.historyStateByConversation);
  const historyPageInfoByConversation = useChatStore(
    (state) => state.historyPageInfoByConversation
  );
  const olderHistoryStateByConversation = useChatStore(
    (state) => state.olderHistoryStateByConversation
  );
  const historyErrorByConversation = useChatStore((state) => state.historyErrorByConversation);
  const membersByConversation = useChatStore((state) => state.membersByConversation);
  const contextByConversation = useChatStore((state) => state.contextByConversation);
  const detailsStateByConversation = useChatStore((state) => state.detailsStateByConversation);
  const detailsErrorByConversation = useChatStore((state) => state.detailsErrorByConversation);
  const typingByConversation = useChatStore((state) => state.typingByConversation);
  const searchQuery = useChatStore((state) => state.searchQuery);
  const draftMessage = useChatStore((state) => state.draftMessage);
  const isChatListOpen = useChatStore((state) => state.isChatListOpen);
  const isInfoPanelOpen = useChatStore((state) => state.isInfoPanelOpen);
  const connectionState = useChatStore((state) => state.connectionState);
  const realtimeError = useChatStore((state) => state.realtimeError);
  const composerLocked = useChatStore((state) => state.composerLocked);
  const composerNotice = useChatStore((state) => state.composerNotice);
  const sendRealtime = useChatStore((state) => state.sendRealtime);
  const onlineUserIds = useChatStore((state) => state.onlineUserIds);

  const resetChat = useChatStore((state) => state.reset);
  const selectConversation = useChatStore((state) => state.selectConversation);
  const setSearchQuery = useChatStore((state) => state.setSearchQuery);
  const setDraftMessage = useChatStore((state) => state.setDraftMessage);
  const setChatListOpen = useChatStore((state) => state.setChatListOpen);
  const setInfoPanelOpen = useChatStore((state) => state.setInfoPanelOpen);

  const typingConversationRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inboxRefreshInFlightRef = useRef(false);
  const conversationRefreshInFlightRef = useRef<string | null>(null);
  const placeholderRefreshAtRef = useRef<Record<string, number>>({});
  const readAckedMessagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      resetChat();
      resetContacts();
    }
  }, [authStatus, resetChat, resetContacts]);

  useEffect(() => {
    if (authStatus === 'authenticated' && conversationsState === 'idle') {
      void loadConversationListAction();
    }
  }, [authStatus, conversationsState]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || contactsStatus !== 'idle') {
      return;
    }
    void loadContactsAction();
  }, [authStatus, contactsStatus]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || connectionState !== 'connected') {
      return;
    }

    const refreshInbox = async () => {
      if (inboxRefreshInFlightRef.current) {
        return;
      }
      inboxRefreshInFlightRef.current = true;
      try {
        await loadConversationListAction({ background: true });
      } finally {
        inboxRefreshInFlightRef.current = false;
      }
    };

    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') {
        void refreshInbox();
      }
    }, 5000);

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refreshInbox();
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [authStatus, connectionState]);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? null;

  const peerOnline = useMemo(() => {
    if (!activeConversation || activeConversation.type !== 'direct') {
      return null;
    }
    const peerId = activeConversation.directPeer?.userId;
    return peerId ? onlineUserIds.has(peerId) : null;
  }, [activeConversation, onlineUserIds]);

  const stopTyping = useCallback(
    (conversationId: string | null = typingConversationRef.current) => {
      if (!conversationId) {
        return;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (sendRealtime) {
        sendRealtime({ type: 'chat:typing:stop', data: { conversationId } });
      }

      if (typingConversationRef.current === conversationId) {
        typingConversationRef.current = null;
      }
    },
    [sendRealtime]
  );

  useEffect(() => {
    if (!activeConversation) {
      syncComposerForConversation(null);
      return;
    }

    if ((historyStateByConversation[activeConversation.id] ?? 'idle') === 'idle') {
      void loadConversationHistoryAction(activeConversation);
    }

    if ((detailsStateByConversation[activeConversation.id] ?? 'idle') === 'idle') {
      void loadConversationDetailsAction(activeConversation);
    } else {
      syncComposerForConversation(activeConversation.id);
    }
  }, [activeConversation, detailsStateByConversation, historyStateByConversation]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || connectionState !== 'connected' || !activeConversation) {
      return;
    }

    const refreshActiveConversation = async () => {
      if (conversationRefreshInFlightRef.current === activeConversation.id) {
        return;
      }
      conversationRefreshInFlightRef.current = activeConversation.id;
      try {
        await refreshConversationStateAction(activeConversation.id);
      } finally {
        if (conversationRefreshInFlightRef.current === activeConversation.id) {
          conversationRefreshInFlightRef.current = null;
        }
      }
    };

    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') {
        void refreshActiveConversation();
      }
    }, 6000);

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refreshActiveConversation();
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [activeConversation, authStatus, connectionState]);

  useEffect(() => {
    if (!activeConversation || !sendRealtime || connectionState !== 'connected') {
      return;
    }

    const trimmedDraft = draftMessage.trim();

    if (!trimmedDraft) {
      if (typingConversationRef.current === activeConversation.id) {
        stopTyping(activeConversation.id);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }

    if (typingConversationRef.current !== activeConversation.id) {
      sendRealtime({ type: 'chat:typing:start', data: { conversationId: activeConversation.id } });
      typingConversationRef.current = activeConversation.id;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (!sendRealtime) {
        return;
      }
      sendRealtime({ type: 'chat:typing:stop', data: { conversationId: activeConversation.id } });
      typingConversationRef.current = null;
      typingTimeoutRef.current = null;
    }, 1500);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [activeConversation, connectionState, draftMessage, sendRealtime, stopTyping]);

  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [activeConversation?.id, connectionState, stopTyping]);

  const activeMessages = activeConversation
    ? (messagesByConversation[activeConversation.id] ?? [])
    : [];
  const activeMembers = activeConversation
    ? (membersByConversation[activeConversation.id] ?? [])
    : [];
  const activeContext = activeConversation
    ? (contextByConversation[activeConversation.id] ?? null)
    : null;
  const historyState = activeConversation
    ? (historyStateByConversation[activeConversation.id] ?? 'idle')
    : 'idle';
  const historyPageInfo = activeConversation
    ? (historyPageInfoByConversation[activeConversation.id] ?? null)
    : null;
  const olderHistoryState = activeConversation
    ? (olderHistoryStateByConversation[activeConversation.id] ?? 'idle')
    : 'idle';
  const historyError = activeConversation
    ? (historyErrorByConversation[activeConversation.id] ?? null)
    : null;
  const detailsState = activeConversation
    ? (detailsStateByConversation[activeConversation.id] ?? 'idle')
    : 'idle';
  const detailsError = activeConversation
    ? (detailsErrorByConversation[activeConversation.id] ?? null)
    : null;

  useEffect(() => {
    if (
      authStatus !== 'authenticated' ||
      connectionState !== 'connected' ||
      !sendRealtime ||
      !activeConversation ||
      !currentUser?.id ||
      AppState.currentState !== 'active'
    ) {
      return;
    }

    for (const message of activeMessages) {
      if (message.senderId === currentUser.id || readAckedMessagesRef.current.has(message.id)) {
        continue;
      }

      const sent = sendRealtime({
        type: 'chat:delivery:ack',
        data: {
          conversationId: message.conversationId,
          messageId: message.id,
          status: 'read',
          clientTimestamp: new Date().toISOString(),
        },
      } satisfies ChatSocketRequest<{
        conversationId: string;
        messageId: string;
        status: 'read';
        clientTimestamp: string;
      }>);

      if (sent) {
        readAckedMessagesRef.current.add(message.id);
      }
    }
  }, [activeConversation, activeMessages, authStatus, connectionState, currentUser?.id, sendRealtime]);

  useEffect(() => {
    if (
      authStatus !== 'authenticated' ||
      connectionState !== 'connected' ||
      !activeConversation ||
      activeConversation.type !== 'group'
    ) {
      return;
    }

    const hasPlaceholderMessages = activeMessages.some(
      (message) => message.kind === 'text' && message.previewFallback
    );
    const requiresSenderKeySync = activeContext?.senderKeyState?.distributionRequired === true;

    if (!hasPlaceholderMessages && !requiresSenderKeySync) {
      return;
    }

    const lastRefreshAt = placeholderRefreshAtRef.current[activeConversation.id] ?? 0;

    if (Date.now() - lastRefreshAt < 1500) {
      return;
    }

    placeholderRefreshAtRef.current[activeConversation.id] = Date.now();
    void refreshConversationStateAction(activeConversation.id);
  }, [
    activeContext?.senderKeyState?.distributionRequired,
    activeConversation,
    activeMessages,
    authStatus,
    connectionState,
  ]);

  const membersById = useMemo(
    () => Object.fromEntries(activeMembers.map((member) => [member.id, member])),
    [activeMembers]
  );

  const typingNames = useMemo(
    () =>
      !activeConversation
        ? []
        : ((typingByConversation[activeConversation.id] ?? [])
            .map((participantId) => membersById[participantId]?.name)
            .filter(Boolean) as string[]),
    [activeConversation, membersById, typingByConversation]
  );

  const currentUserId = currentUser?.id ?? null;
  const currentUserLabel =
    profile?.displayName?.trim() ||
    profile?.username?.trim() ||
    (currentUser ? getShortWallet(currentUser.walletAddress) : 'You');

  const handleSelectConversation = (conversationId: string) => {
    selectConversation(conversationId);
    syncComposerForConversation(conversationId);
  };

  const handleSendMessage = async () => {
    if (!activeConversation) {
      return false;
    }

    const text = draftMessage.trim();
    if (!text) {
      return false;
    }

    try {
      await sendEncryptedMessageAction({ conversation: activeConversation, text });
      await refreshConversationStateAction(activeConversation.id);
      void loadPaymentsSnapshotAction({ background: true }).catch(() => undefined);
      stopTyping(activeConversation.id);
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'INSUFFICIENT_CREDITS') {
        openPaymentsPanelAction({
          source: 'message-send',
          recoveryMessage: 'Add credits to keep sending messages in this conversation.',
        });
      }
      useChatStore
        .getState()
        .setRealtimeError(error instanceof Error ? error.message : 'Failed to send message');
      return false;
    }
  };

  const handleCreateGroup = async () => {
    try {
      const conversation = await createGroupConversationAction();
      syncComposerForConversation(conversation.id);
      return conversation;
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'INSUFFICIENT_CREDITS') {
        openPaymentsPanelAction({
          source: 'group-create',
          recoveryMessage: 'Recharge your balance before creating another group room.',
        });
      }
      throw error;
    }
  };

  const handleLoadOlderMessages = async () => {
    if (!activeConversation || olderHistoryState === 'loading') {
      return;
    }
    await loadOlderConversationHistoryAction(activeConversation);
  };

  const handleComposerBlur = () => {
    stopTyping(activeConversation?.id ?? null);
  };

  const handleJoinGroup = async (roomId: string) => {
    const conversation = await joinGroupConversationAction(roomId);
    syncComposerForConversation(conversation.id);
    return conversation;
  };

  const handleLeaveGroup = async (roomId: string) => {
    await leaveGroupConversationAction(roomId);
    syncComposerForConversation(useChatStore.getState().activeConversationId);
  };

  return {
    conversations,
    conversationsState,
    conversationsError,
    activeConversation,
    activeContext,
    activeMessages,
    activeMembers,
    membersById,
    typingNames,
    searchQuery,
    draftMessage,
    currentUserId,
    currentUserLabel,
    isChatListOpen,
    isInfoPanelOpen,
    historyState,
    historyPageInfo,
    olderHistoryState,
    historyError,
    detailsState,
    detailsError,
    connectionState,
    realtimeError,
    peerOnline,
    onlineUserIds,
    composerLocked,
    composerNotice,
    handleSelectConversation,
    handleSendMessage,
    handleComposerBlur,
    handleLoadOlderMessages,
    handleCreateGroup,
    handleJoinGroup,
    handleLeaveGroup,
    setSearchQuery,
    setDraftMessage,
    setChatListOpen,
    setInfoPanelOpen,
    searchUsers: searchDirectoryUsersAction,
    startDirectConversation: startDirectConversationAction,
  };
}
