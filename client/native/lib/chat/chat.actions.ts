import { getAuthenticatedAccessToken } from '@/lib/auth';
import { randomUUID } from '@/lib/crypto';
import {
  buildDirectTextEnvelope,
  buildGroupTextEnvelope,
  createSenderKeyDistribution,
  decryptConversationEnvelope,
  ensureResolvedGroupSenderKey,
  getStoredLocalAuthDevice,
  getStoredSenderKeyValue,
  persistSenderKey,
} from '@/lib/e2ee';
import {
  chatApi,
  contactsApi,
  dmApi,
  paymentsApi,
  roomsApi,
  userApi,
} from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { useContactsStore } from '@/store/contacts.store';
import { useUserStore } from '@/store/user.store';
import type {
  ChatConversation,
  ChatConversationContext,
  ChatConversationSummary,
  ChatHistoryItem,
  ChatMember,
  ChatMessage,
  ChatMessageKind,
  RoomMember,
} from '@/types';

/**
 * Chat orchestration actions. Ported from the web client's
 * `features/chat/chat.hooks.ts` (the exported action functions). The React
 * hooks that consume these live in `hooks/useChatShell.ts` and
 * `hooks/useChatRealtime.ts`.
 */

function getShortWallet(walletAddress: string) {
  return `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
}

/** On native we use initials avatars, so keep a stable seed rather than a URL. */
function getAvatarSeed(seed: string) {
  return seed;
}

function getContactAlias(userId: string | null | undefined) {
  if (!userId) {
    return null;
  }

  return (
    useContactsStore.getState().contacts.find((contact) => contact.user.id === userId)?.alias ??
    null
  );
}

function getPreferredName(input: {
  userId?: string | null;
  displayName?: string | null;
  username?: string | null;
  walletAddress: string;
}) {
  return (
    getContactAlias(input.userId) ||
    input.displayName?.trim() ||
    input.username?.trim() ||
    getShortWallet(input.walletAddress)
  );
}

function getConversationName(summary: ChatConversationSummary) {
  if (summary.type === 'direct' && summary.directPeer) {
    return getPreferredName({
      userId: summary.directPeer.userId,
      displayName: summary.directPeer.displayName,
      username: summary.directPeer.username,
      walletAddress: summary.directPeer.walletAddress,
    });
  }

  return `Room ${summary.id.slice(0, 8).toUpperCase()}`;
}

function getConversationDescription(input: {
  summary: ChatConversationSummary;
  memberCount?: number;
  senderKeyStatus?: string | null;
}) {
  const { summary } = input;

  if (summary.type === 'direct' && summary.directPeer) {
    const handle = summary.directPeer.username
      ? `@${summary.directPeer.username}`
      : getShortWallet(summary.directPeer.walletAddress);
    return `${handle} • ${summary.directPeer.deviceBundles.length} devices`;
  }

  const memberCount = input.memberCount ?? summary.groupState?.memberCount ?? 0;
  const senderKeyState =
    input.senderKeyStatus ?? summary.groupState?.senderKeyState?.status ?? 'pending';

  return `${memberCount} members • sender key ${senderKeyState}`;
}

function getConversationSearchValue(summary: ChatConversationSummary) {
  const directPeerValues =
    summary.directPeer == null
      ? []
      : [
          summary.directPeer.displayName ?? '',
          summary.directPeer.username ?? '',
          summary.directPeer.walletAddress,
        ];
  const groupValues =
    summary.groupState == null
      ? []
      : [String(summary.groupState.memberCount), summary.groupState.senderKeyState?.status ?? ''];

  return [
    getConversationName(summary),
    getConversationDescription({ summary }),
    summary.id,
    ...directPeerValues,
    ...groupValues,
  ]
    .join(' ')
    .toLowerCase();
}

function getRelativeLabel(value: string | null) {
  if (!value) {
    return 'No activity yet';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.round(diffHours / 24)}d ago`;
}

function getEncryptedPreview(kind: ChatMessageKind | null) {
  if (kind === 'image') {
    return 'Encrypted image payload';
  }

  if (kind === 'text') {
    return 'Encrypted message';
  }

  return 'No encrypted messages yet';
}

function mapConversation(input: {
  summary: ChatConversationSummary;
  currentUserId: string | null;
  walletAddress: string | null;
}): ChatConversation {
  const { summary } = input;
  const localDevice = input.walletAddress ? getStoredLocalAuthDevice(input.walletAddress) : null;
  const decryptedLastMessage =
    summary.lastMessageCiphertext && input.currentUserId && input.walletAddress
      ? decryptConversationEnvelope({
          envelope: summary.lastMessageCiphertext,
          kind: summary.lastMessageKind ?? 'text',
          currentUserId: input.currentUserId,
          walletAddress: input.walletAddress,
          localDevice,
          peerDeviceBundles: summary.directPeer?.deviceBundles ?? [],
          members: null,
          senderKeyState: summary.groupState?.senderKeyState ?? null,
          senderId: summary.directPeer?.userId ?? summary.createdBy,
        })
      : null;

  return {
    id: summary.id,
    type: summary.type,
    room: {
      id: summary.id,
      type: summary.type,
      createdBy: summary.createdBy,
      lastMessageId: summary.lastMessageId,
      lastMessageAt: summary.lastMessageAt,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    },
    name: getConversationName(summary),
    description: getConversationDescription({ summary }),
    searchValue: getConversationSearchValue(summary),
    avatarSrc: getAvatarSeed(
      summary.directPeer?.walletAddress ?? summary.directPeer?.userId ?? summary.id
    ),
    lastMessageAt: summary.lastMessageAt,
    lastMessageKind: summary.lastMessageKind,
    lastMessagePreview: decryptedLastMessage?.text ?? getEncryptedPreview(summary.lastMessageKind),
    lastMessagePreviewFallback: decryptedLastMessage?.isPlaceholder ?? true,
    lastActivityLabel: getRelativeLabel(summary.lastMessageAt),
    unreadCount: 0,
    memberCount: summary.groupState?.memberCount ?? 2,
    mutedUntil: summary.mutedUntil,
    directPeer: summary.directPeer,
    senderKeyState: summary.groupState?.senderKeyState ?? null,
  };
}

function mapHistoryMessage(input: {
  item: ChatHistoryItem;
  conversation: ChatConversation;
  currentUserId: string | null;
  walletAddress: string | null;
  members: RoomMember[] | null;
  context: ChatConversationContext | null;
}): ChatMessage {
  const localDevice = input.walletAddress ? getStoredLocalAuthDevice(input.walletAddress) : null;
  const decrypted =
    input.currentUserId && input.walletAddress
      ? decryptConversationEnvelope({
          envelope: input.item.ciphertext,
          kind: input.item.kind,
          currentUserId: input.currentUserId,
          walletAddress: input.walletAddress,
          localDevice,
          peerDeviceBundles: input.conversation.directPeer?.deviceBundles ?? [],
          members: input.members,
          senderKeyState: input.context?.senderKeyState ?? input.conversation.senderKeyState,
          senderId: input.item.senderId,
        })
      : null;

  return {
    id: input.item.id,
    conversationId: input.item.conversationId,
    senderId: input.item.senderId,
    kind: input.item.kind,
    ciphertext: input.item.ciphertext,
    createdAt: input.item.createdAt,
    editedAt: input.item.editedAt,
    previewText: decrypted?.text ?? getEncryptedPreview(input.item.kind),
    previewFallback: decrypted?.isPlaceholder ?? true,
    deliveryState: 'stored',
    algorithm: input.item.ciphertext.algorithm,
    senderDeviceId: input.item.ciphertext.senderDeviceId,
    canDeleteForEveryone: input.item.senderId === input.currentUserId,
  };
}

export function mapRoomMember(member: RoomMember): ChatMember {
  return {
    id: member.userId,
    name: getPreferredName({
      userId: member.userId,
      displayName: member.displayName,
      username: member.username,
      walletAddress: member.walletAddress,
    }),
    walletAddress: member.walletAddress,
    username: member.username,
    role: member.role === 'admin' ? 'Room admin' : 'Room member',
    memberRole: member.role,
    status: member.devices.length ? 'verified' : 'limited',
    avatarSrc: getAvatarSeed(member.walletAddress),
    deviceCount: member.devices.length,
  };
}

function buildSelfMember(input: {
  userId: string;
  walletAddress: string;
  displayName: string;
  deviceCount: number;
}): ChatMember {
  return {
    id: input.userId,
    name: input.displayName,
    walletAddress: input.walletAddress,
    username: null,
    role: 'You',
    memberRole: null,
    status: input.deviceCount ? 'verified' : 'limited',
    avatarSrc: getAvatarSeed(input.walletAddress),
    deviceCount: input.deviceCount,
  };
}

async function requireAccessToken() {
  return getAuthenticatedAccessToken();
}

export async function loadContactsAction() {
  const contacts = useContactsStore.getState();
  const accessToken = await requireAccessToken();

  contacts.setStatus('loading');

  try {
    const response = await contactsApi.listContacts(accessToken);
    contacts.setContacts(response.contacts);
    await loadConversationListAction({ background: true });
    const activeConversation =
      useChatStore
        .getState()
        .conversations.find(
          (conversation) => conversation.id === useChatStore.getState().activeConversationId
        ) ?? null;
    if (activeConversation) {
      await loadConversationDetailsAction(activeConversation, { background: true });
    }
  } catch (error) {
    contacts.setStatus('error');
    contacts.setError(error instanceof Error ? error.message : 'Unable to load contacts.');
  }
}

export function syncComposerForConversation(conversationId: string | null) {
  const chat = useChatStore.getState();

  if (!conversationId) {
    chat.setComposerState({
      locked: true,
      notice: 'Select a conversation to start encrypted messaging.',
    });
    return;
  }

  const conversation = chat.conversations.find((item) => item.id === conversationId);
  const authUser = useAuthStore.getState().user;

  if (!conversation || !authUser) {
    chat.setComposerState({ locked: true, notice: 'Your encrypted session is not ready yet.' });
    return;
  }

  const localDevice = getStoredLocalAuthDevice(authUser.walletAddress);

  if (!localDevice) {
    chat.setComposerState({
      locked: true,
      notice:
        'This device is missing its local chat keys. Sign in again to restore encrypted messaging.',
    });
    return;
  }

  if (conversation.type === 'direct') {
    const hasPeerBundles = (conversation.directPeer?.deviceBundles.length ?? 0) > 0;
    chat.setComposerState({
      locked: !hasPeerBundles,
      notice: hasPeerBundles
        ? null
        : 'This direct conversation has no active peer devices available for encrypted messaging.',
    });
    return;
  }

  const context = chat.contextByConversation[conversationId] ?? null;
  const members = chat.membersByConversation[conversationId] ?? [];

  if (!context || !members.length) {
    chat.setComposerState({
      locked: true,
      notice: 'Load room members and sender-key state before sending encrypted group messages.',
    });
    return;
  }

  if (!context.senderKeyState) {
    chat.setComposerState({ locked: true, notice: 'This group room has no sender-key state yet.' });
    return;
  }

  const resolvedSenderKey = ensureResolvedGroupSenderKey({
    walletAddress: authUser.walletAddress,
    roomId: conversationId,
    epochId: context.senderKeyState.epochId,
    localDevice,
    members: chat.roomMembersByConversation[conversationId] ?? [],
    senderDeviceId: context.senderKeyState.createdByDeviceId ?? localDevice.registration.deviceId,
    distribution: null,
    senderKeyState: context.senderKeyState,
  });

  chat.setComposerState({
    locked: false,
    notice:
      context.senderKeyState.distributionRequired && !resolvedSenderKey
        ? 'The next message will refresh the group sender-key distribution.'
        : null,
  });
}

function refreshConversationDecryption(conversationId: string) {
  const chat = useChatStore.getState();
  const authUser = useAuthStore.getState().user;
  const conversation = chat.conversations.find((item) => item.id === conversationId);

  if (!conversation || !authUser) {
    return;
  }

  const members =
    conversation.type === 'group'
      ? (chat.roomMembersByConversation[conversationId] ?? [])
      : null;
  const context = chat.contextByConversation[conversationId] ?? null;

  chat.mapConversationMessages(conversationId, (message) =>
    mapHistoryMessage({
      item: {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        kind: message.kind,
        ciphertext: message.ciphertext,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
      },
      conversation,
      currentUserId: authUser.id,
      walletAddress: authUser.walletAddress,
      members,
      context,
    })
  );

  syncComposerForConversation(conversationId);
}

export async function loadConversationListAction(options?: { background?: boolean }) {
  const chat = useChatStore.getState();
  const authUser = useAuthStore.getState().user;
  const isBackground = options?.background === true;

  if (!isBackground) {
    chat.setConversationsState('loading');
  }

  chat.setConversationsError(null);

  try {
    const accessToken = await requireAccessToken();
    const response = await chatApi.getConversationList(accessToken);
    chat.setConversations(
      response.conversations.map((summary) =>
        mapConversation({
          summary,
          currentUserId: authUser?.id ?? null,
          walletAddress: authUser?.walletAddress ?? null,
        })
      )
    );
    syncComposerForConversation(chat.activeConversationId);
  } catch (error) {
    if (!isBackground) {
      chat.setConversationsState('error');
      chat.setConversationsError(
        error instanceof Error ? error.message : 'Failed to load conversations'
      );
    }
  }
}

export async function loadConversationHistoryAction(conversation: ChatConversation) {
  const chat = useChatStore.getState();
  const authUser = useAuthStore.getState().user;
  chat.setHistoryState(conversation.id, 'loading');
  chat.setHistoryError(conversation.id, null);

  try {
    const accessToken = await requireAccessToken();
    const response = await chatApi.getConversationHistory({
      accessToken,
      conversationId: conversation.id,
      query: { limit: 100 },
    });
    const members =
      conversation.type === 'group'
        ? (chat.roomMembersByConversation[conversation.id] ?? [])
        : null;
    const context = chat.contextByConversation[conversation.id] ?? null;

    chat.setMessages(
      conversation.id,
      response.messages.map((item) =>
        mapHistoryMessage({
          item,
          conversation,
          currentUserId: authUser?.id ?? null,
          walletAddress: authUser?.walletAddress ?? null,
          members,
          context,
        })
      ),
      response.pageInfo
    );
  } catch (error) {
    chat.setHistoryState(conversation.id, 'error');
    chat.setHistoryError(
      conversation.id,
      error instanceof Error ? error.message : 'Failed to load conversation'
    );
  }
}

export async function loadOlderConversationHistoryAction(conversation: ChatConversation) {
  const chat = useChatStore.getState();
  const pageInfo = chat.historyPageInfoByConversation[conversation.id];

  if (!pageInfo?.hasMore || !pageInfo.nextBeforeMessageId) {
    return;
  }

  chat.setOlderHistoryState(conversation.id, 'loading');
  chat.setHistoryError(conversation.id, null);

  try {
    const authUser = useAuthStore.getState().user;
    const accessToken = await requireAccessToken();
    const response = await chatApi.getConversationHistory({
      accessToken,
      conversationId: conversation.id,
      query: { limit: pageInfo.limit, beforeMessageId: pageInfo.nextBeforeMessageId },
    });
    const members =
      conversation.type === 'group'
        ? (chat.roomMembersByConversation[conversation.id] ?? [])
        : null;
    const context = chat.contextByConversation[conversation.id] ?? null;

    chat.prependMessages(
      conversation.id,
      response.messages.map((item) =>
        mapHistoryMessage({
          item,
          conversation,
          currentUserId: authUser?.id ?? null,
          walletAddress: authUser?.walletAddress ?? null,
          members,
          context,
        })
      ),
      response.pageInfo
    );
  } catch (error) {
    chat.setOlderHistoryState(conversation.id, 'error');
    chat.setHistoryError(
      conversation.id,
      error instanceof Error ? error.message : 'Failed to load older messages'
    );
  }
}

export async function loadConversationDetailsAction(
  conversation: ChatConversation,
  options?: { background?: boolean }
) {
  const chat = useChatStore.getState();
  const isBackground = options?.background === true;

  if (!isBackground) {
    chat.setDetailsState(conversation.id, 'loading');
  }

  chat.setDetailsError(conversation.id, null);

  try {
    const authUser = useAuthStore.getState().user;
    const profile = useUserStore.getState().profile;

    if (conversation.type === 'direct') {
      const members: ChatMember[] = [];

      if (authUser) {
        members.push(
          buildSelfMember({
            userId: authUser.id,
            walletAddress: authUser.walletAddress,
            displayName:
              profile?.displayName?.trim() ||
              profile?.username?.trim() ||
              getShortWallet(authUser.walletAddress),
            deviceCount: authUser.activeDeviceId ? 1 : 0,
          })
        );
      }

      if (conversation.directPeer) {
        members.push({
          id: conversation.directPeer.userId,
          name: getPreferredName({
            userId: conversation.directPeer.userId,
            displayName: conversation.directPeer.displayName,
            username: conversation.directPeer.username,
            walletAddress: conversation.directPeer.walletAddress,
          }),
          walletAddress: conversation.directPeer.walletAddress,
          username: conversation.directPeer.username,
          role: 'Direct contact',
          memberRole: null,
          status: conversation.directPeer.deviceBundles.length ? 'verified' : 'limited',
          avatarSrc: getAvatarSeed(conversation.directPeer.walletAddress),
          deviceCount: conversation.directPeer.deviceBundles.length,
        });
      }

      const context: ChatConversationContext = {
        room: conversation.room,
        membership: null,
        senderKeyState: null,
      };

      chat.setMembers(conversation.id, members);
      chat.setContext(conversation.id, context);
      refreshConversationDecryption(conversation.id);
      return;
    }

    const accessToken = await requireAccessToken();
    const [roomDetail, roomMembers] = await Promise.all([
      roomsApi.getRoom(conversation.id, accessToken),
      roomsApi.getRoomMembers(conversation.id, accessToken),
    ]);

    chat.setMembers(conversation.id, roomMembers.members.map(mapRoomMember));
    chat.setRoomMembers(conversation.id, roomMembers.members);
    chat.setContext(conversation.id, {
      room: roomDetail.room,
      membership: roomDetail.membership,
      senderKeyState: roomDetail.senderKeyState,
    });
    chat.patchConversation(conversation.id, {
      memberCount: roomMembers.members.length,
      description: getConversationDescription({
        summary: {
          id: conversation.id,
          type: conversation.type,
          createdBy: conversation.room.createdBy,
          createdAt: conversation.room.createdAt,
          updatedAt: conversation.room.updatedAt,
          mutedUntil: conversation.mutedUntil,
          lastMessageId: conversation.room.lastMessageId,
          lastMessageAt: conversation.room.lastMessageAt,
          lastMessageKind: conversation.lastMessageKind,
          lastMessageCiphertext: null,
          directPeer: conversation.directPeer,
          groupState: {
            memberCount: roomMembers.members.length,
            senderKeyState: roomDetail.senderKeyState,
          },
        },
        memberCount: roomMembers.members.length,
        senderKeyStatus: roomDetail.senderKeyState?.status ?? 'pending',
      }),
      senderKeyState: roomDetail.senderKeyState,
    });
    refreshConversationDecryption(conversation.id);
  } catch (error) {
    if (!isBackground) {
      chat.setDetailsState(conversation.id, 'error');
      chat.setDetailsError(
        conversation.id,
        error instanceof Error ? error.message : 'Failed to load room details'
      );
    }
  }
}

export async function refreshConversationStateAction(conversationId: string) {
  const chat = useChatStore.getState();
  await loadConversationListAction({ background: true });

  const refreshedConversation =
    useChatStore
      .getState()
      .conversations.find((conversation) => conversation.id === conversationId) ??
    chat.conversations.find((conversation) => conversation.id === conversationId);

  if (!refreshedConversation) {
    return;
  }

  await loadConversationDetailsAction(refreshedConversation, { background: true });
}

async function ensureGroupEnvelopeState(conversation: ChatConversation) {
  const chat = useChatStore.getState();
  const authUser = useAuthStore.getState().user;

  if (!authUser) {
    throw new Error('Not authenticated');
  }

  const localDevice = getStoredLocalAuthDevice(authUser.walletAddress);
  const context = chat.contextByConversation[conversation.id] ?? null;
  const members = chat.roomMembersByConversation[conversation.id] ?? [];

  if (!localDevice || !context?.senderKeyState) {
    throw new Error('Group encryption state is not ready yet');
  }

  if (context.senderKeyState.distributionRequired) {
    const existingSenderKey =
      getStoredSenderKeyValue(authUser.walletAddress, context.senderKeyState.epochId) ??
      ensureResolvedGroupSenderKey({
        walletAddress: authUser.walletAddress,
        roomId: conversation.id,
        epochId: context.senderKeyState.epochId,
        localDevice,
        members,
        senderDeviceId:
          context.senderKeyState.createdByDeviceId ?? localDevice.registration.deviceId,
        distribution: null,
        senderKeyState: context.senderKeyState,
      });

    const distribution = createSenderKeyDistribution({
      roomId: conversation.id,
      epochId: context.senderKeyState.epochId,
      senderDevice: localDevice,
      members,
      senderKey: existingSenderKey ?? undefined,
    });

    persistSenderKey({
      walletAddress: authUser.walletAddress,
      roomId: conversation.id,
      epochId: context.senderKeyState.epochId,
      key: distribution.senderKey,
    });

    return { senderKey: distribution.senderKey, distribution };
  }

  const senderKey = ensureResolvedGroupSenderKey({
    walletAddress: authUser.walletAddress,
    roomId: conversation.id,
    epochId: context.senderKeyState.epochId,
    localDevice,
    members,
    senderDeviceId: context.senderKeyState.createdByDeviceId ?? localDevice.registration.deviceId,
    distribution: null,
    senderKeyState: context.senderKeyState,
  });

  if (!senderKey) {
    throw new Error('Unable to resolve the current group sender key');
  }

  return { senderKey, distribution: null };
}

export async function sendEncryptedMessageAction(input: {
  conversation: ChatConversation;
  text: string;
}) {
  const chat = useChatStore.getState();
  const authUser = useAuthStore.getState().user;

  if (!authUser) {
    throw new Error('Not authenticated');
  }

  const localDevice = getStoredLocalAuthDevice(authUser.walletAddress);

  if (!localDevice) {
    throw new Error('Local encryption keys are unavailable');
  }

  if (!chat.sendRealtime) {
    throw new Error('Realtime connection is not ready');
  }

  await refreshConversationStateAction(input.conversation.id);

  const refreshedConversation =
    useChatStore
      .getState()
      .conversations.find((conversation) => conversation.id === input.conversation.id) ??
    input.conversation;

  const messageId = randomUUID();
  const clientTimestamp = new Date().toISOString();
  let ciphertext: ChatMessage['ciphertext'];

  if (refreshedConversation.type === 'direct') {
    const recipients = refreshedConversation.directPeer?.deviceBundles ?? [];

    if (!recipients.length) {
      throw new Error('This conversation has no active peer devices');
    }

    ciphertext = buildDirectTextEnvelope({
      text: input.text,
      sentAt: clientTimestamp,
      senderDevice: localDevice,
      recipients,
    });
  } else {
    const { senderKey, distribution } = await ensureGroupEnvelopeState(refreshedConversation);

    ciphertext = buildGroupTextEnvelope({
      text: input.text,
      sentAt: clientTimestamp,
      senderDevice: localDevice,
      roomId: refreshedConversation.id,
      epochId: refreshedConversation.senderKeyState?.epochId ?? '',
      senderKey,
      distribution,
    });
  }

  chat.appendRealtimeMessage({
    message: {
      id: messageId,
      conversationId: refreshedConversation.id,
      senderId: authUser.id,
      kind: 'text',
      ciphertext,
      createdAt: clientTimestamp,
      editedAt: null,
      previewText: input.text,
      previewFallback: false,
      deliveryState: 'sending',
      algorithm: ciphertext.algorithm,
      senderDeviceId: ciphertext.senderDeviceId,
      canDeleteForEveryone: true,
    },
    isOwnMessage: true,
    markUnread: false,
  });

  const sent = chat.sendRealtime({
    type: 'chat:message:send',
    data: {
      messageId,
      conversationId: refreshedConversation.id,
      kind: 'text',
      ciphertext,
      clientTimestamp,
    },
  });

  if (!sent) {
    chat.updateDeliveryState(refreshedConversation.id, messageId, 'rejected');
    throw new Error('Realtime connection is unavailable');
  }

  chat.setDraftMessage('');
}

export async function searchDirectoryUsersAction(query: string) {
  const accessToken = await requireAccessToken();
  return userApi.searchUsers(query, accessToken);
}

export async function startDirectConversationAction(input: {
  username?: string;
  walletAddress?: string;
}) {
  const chat = useChatStore.getState();
  const accessToken = await requireAccessToken();
  const authUser = useAuthStore.getState().user;
  const response = await dmApi.startDirectConversation(input, accessToken);
  await loadConversationListAction();

  const existingConversation = useChatStore
    .getState()
    .conversations.find((conversation) => conversation.id === response.conversation.id);

  if (existingConversation) {
    chat.selectConversation(existingConversation.id);
    await loadConversationDetailsAction(existingConversation);
    await loadConversationHistoryAction(existingConversation);
    return existingConversation;
  }

  const fallbackSummary: ChatConversationSummary = {
    ...response.conversation,
    mutedUntil: null,
    lastMessageKind: null,
    lastMessageCiphertext: null,
    directPeer: {
      userId: response.peerUserId,
      walletAddress:
        input.walletAddress ??
        useUserStore.getState().profile?.walletAddress ??
        authUser?.walletAddress ??
        '',
      username: input.username ?? null,
      displayName: null,
      deviceBundles: response.peerDeviceBundles,
    },
    groupState: null,
  };
  const fallbackConversation = mapConversation({
    summary: fallbackSummary,
    currentUserId: authUser?.id ?? null,
    walletAddress: authUser?.walletAddress ?? null,
  });
  chat.setConversations([fallbackConversation, ...chat.conversations]);
  chat.selectConversation(fallbackConversation.id);
  await loadConversationDetailsAction(fallbackConversation);
  await loadConversationHistoryAction(fallbackConversation);
  return fallbackConversation;
}

export async function createGroupConversationAction() {
  const chat = useChatStore.getState();
  const authUser = useAuthStore.getState().user;
  const accessToken = await requireAccessToken();
  const response = await roomsApi.createGroupRoom({ type: 'group' }, accessToken);
  const summary: ChatConversationSummary = {
    ...response.room,
    mutedUntil: null,
    lastMessageKind: null,
    lastMessageCiphertext: null,
    directPeer: null,
    groupState: { memberCount: 1, senderKeyState: response.senderKeyState },
  };
  const mappedConversation = mapConversation({
    summary,
    currentUserId: authUser?.id ?? null,
    walletAddress: authUser?.walletAddress ?? null,
  });

  chat.setConversations([mappedConversation, ...chat.conversations]);
  chat.selectConversation(mappedConversation.id);
  await loadConversationDetailsAction(mappedConversation);
  return mappedConversation;
}

export async function joinGroupConversationAction(roomId: string) {
  const chat = useChatStore.getState();
  const accessToken = await requireAccessToken();
  await roomsApi.joinRoom(roomId, accessToken);
  await loadConversationListAction();

  const joinedConversation = useChatStore
    .getState()
    .conversations.find((conversation) => conversation.id === roomId);

  if (!joinedConversation) {
    throw new Error('Joined room is not visible in the inbox yet');
  }

  chat.selectConversation(roomId);
  await loadConversationDetailsAction(joinedConversation);
  await loadConversationHistoryAction(joinedConversation);
  return joinedConversation;
}

export async function leaveGroupConversationAction(roomId: string) {
  const chat = useChatStore.getState();
  const accessToken = await requireAccessToken();
  await roomsApi.leaveRoom(roomId, accessToken);
  await loadConversationListAction();
  syncComposerForConversation(chat.activeConversationId);
}

export async function saveContactAliasAction(input: {
  contactUserId: string;
  alias?: string | null;
}) {
  const accessToken = await requireAccessToken();
  const contacts = useContactsStore.getState();
  const chat = useChatStore.getState();

  const contact = await contactsApi.saveContact(input, accessToken);
  contacts.upsertContact(contact);

  await loadConversationListAction({ background: true });

  const activeConversation =
    chat.conversations.find((conversation) => conversation.id === chat.activeConversationId) ??
    null;
  if (activeConversation) {
    await loadConversationDetailsAction(activeConversation, { background: true });
    refreshConversationDecryption(activeConversation.id);
  }

  return contact;
}

export async function updateContactAliasAction(contactUserId: string, alias: string | null) {
  const accessToken = await requireAccessToken();
  const contacts = useContactsStore.getState();
  const chat = useChatStore.getState();

  const contact = await contactsApi.updateContactAlias(contactUserId, alias, accessToken);
  contacts.upsertContact(contact);

  await loadConversationListAction({ background: true });

  const activeConversation =
    chat.conversations.find((conversation) => conversation.id === chat.activeConversationId) ??
    null;
  if (activeConversation) {
    await loadConversationDetailsAction(activeConversation, { background: true });
    refreshConversationDecryption(activeConversation.id);
  }

  return contact;
}

export async function removeContactAliasAction(contactUserId: string) {
  const accessToken = await requireAccessToken();
  const contacts = useContactsStore.getState();
  const chat = useChatStore.getState();

  await contactsApi.removeContact(contactUserId, accessToken);
  contacts.removeContact(contactUserId);

  await loadConversationListAction({ background: true });

  const activeConversation =
    chat.conversations.find((conversation) => conversation.id === chat.activeConversationId) ??
    null;
  if (activeConversation) {
    await loadConversationDetailsAction(activeConversation, { background: true });
    refreshConversationDecryption(activeConversation.id);
  }
}

export async function toggleConversationMuteAction(conversation: ChatConversation) {
  const accessToken = await requireAccessToken();
  const chat = useChatStore.getState();
  const mutedUntil = conversation.mutedUntil
    ? null
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const response = await roomsApi.updateRoomMute(conversation.id, mutedUntil, accessToken);

  chat.patchConversation(conversation.id, { mutedUntil: response.mutedUntil });

  const context = chat.contextByConversation[conversation.id];
  if (context) {
    chat.setContext(conversation.id, {
      ...context,
      membership: context.membership
        ? { ...context.membership, mutedUntil: response.mutedUntil }
        : context.membership,
    });
  }

  await loadConversationListAction({ background: true });
}

export async function hideMessageAction(message: ChatMessage) {
  const accessToken = await requireAccessToken();
  const chat = useChatStore.getState();
  await chatApi.hideMessageForMe(message.id, accessToken);
  chat.removeMessage(message.conversationId, message.id);
  const conversation =
    chat.conversations.find((item) => item.id === message.conversationId) ?? null;
  if (conversation) {
    await loadConversationHistoryAction(conversation);
  }
  await loadConversationListAction({ background: true });
}

export async function deleteMessageAction(message: ChatMessage) {
  const accessToken = await requireAccessToken();
  const chat = useChatStore.getState();
  await chatApi.deleteMessageForEveryone(message.id, accessToken);
  chat.removeMessage(message.conversationId, message.id);
  const conversation =
    chat.conversations.find((item) => item.id === message.conversationId) ?? null;
  if (conversation) {
    await loadConversationHistoryAction(conversation);
  }
  await loadConversationListAction({ background: true });
}

export async function updateGroupMemberRoleAction(input: {
  roomId: string;
  userId: string;
  role: 'admin' | 'member';
}) {
  const accessToken = await requireAccessToken();
  const chat = useChatStore.getState();
  await roomsApi.updateRoomMemberRole(input.roomId, input.userId, input.role, accessToken);

  const conversation = chat.conversations.find((item) => item.id === input.roomId) ?? null;

  if (conversation) {
    await loadConversationDetailsAction(conversation, { background: true });
  }
}

export async function deleteGroupConversationAction(roomId: string) {
  const accessToken = await requireAccessToken();
  const chat = useChatStore.getState();
  await roomsApi.deleteRoom(roomId, accessToken);
  chat.removeConversation(roomId);
  await loadConversationListAction({ background: true });
}
