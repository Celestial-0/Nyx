import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ChatConversation } from '@/types';
import { MenuIcon, MessageSquarePlusIcon, UsersRoundIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { useChatShellContext } from '../chat-shell-context';
import { Sidebar } from '../sidebar/Sidebar';
import { ChatItem } from './ChatItem';
import { DmStartDialog } from './DmStartDialog';
import { GroupRoomDialog } from './GroupRoomDialog';
import { SearchBar } from './SearchBar';

function filterConversations(
  conversations: ChatConversation[],
  query: string
): ChatConversation[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return conversations;
  }
  return conversations.filter((conversation) =>
    conversation.searchValue.toLowerCase().includes(normalized)
  );
}

/** Conversation list with search, new-DM / new-group actions, and states. */
export function ChatList() {
  const { conversations, conversationsState, searchQuery } = useChatShellContext();
  const [dmOpen, setDmOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const visible = useMemo(
    () => filterConversations(conversations, searchQuery),
    [conversations, searchQuery]
  );

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-2 pt-3">
        <View className="flex-row items-center gap-1">
          <Button size="icon" variant="ghost" onPress={() => setMenuOpen(true)}>
            <Icon as={MenuIcon} className="size-5" />
          </Button>
          <Text variant="h3">Chats</Text>
        </View>
        <View className="flex-row gap-1">
          <Button size="icon" variant="ghost" onPress={() => setDmOpen(true)}>
            <Icon as={MessageSquarePlusIcon} className="size-5" />
          </Button>
          <Button size="icon" variant="ghost" onPress={() => setGroupOpen(true)}>
            <Icon as={UsersRoundIcon} className="size-5" />
          </Button>
        </View>
      </View>

      <SearchBar />

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatItem conversation={item} />}
        ListEmptyComponent={
          <View className="items-center px-4 py-10">
            <Text className="text-muted-foreground text-sm">
              {conversationsState === 'loading' ? 'Loading conversations…' : 'No conversations yet.'}
            </Text>
          </View>
        }
      />

      <DmStartDialog open={dmOpen} onClose={() => setDmOpen(false)} />
      <GroupRoomDialog open={groupOpen} onClose={() => setGroupOpen(false)} />
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}
