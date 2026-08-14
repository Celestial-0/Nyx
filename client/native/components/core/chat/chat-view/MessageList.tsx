import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { FlatList, View } from 'react-native';

import { useChatShellContext } from '../chat-shell-context';
import { MessageBubble } from './MessageBubble';

/** Renders the message history for the active conversation (inverted list). */
export function MessageList() {
  const {
    activeMessages,
    currentUserId,
    historyState,
    historyPageInfo,
    olderHistoryState,
    handleLoadOlderMessages,
  } = useChatShellContext();

  // Inverted list: newest at the bottom. Reverse a shallow copy for rendering.
  const data = [...activeMessages].reverse();
  const canLoadOlder = historyPageInfo?.hasMore ?? false;

  return (
    <FlatList
      data={data}
      inverted
      keyExtractor={(item) => item.id}
      contentContainerClassName="px-4 py-2"
      renderItem={({ item }) => (
        <MessageBubble message={item} isOwn={item.senderId === currentUserId} />
      )}
      onEndReached={canLoadOlder ? () => void handleLoadOlderMessages() : undefined}
      onEndReachedThreshold={0.3}
      ListFooterComponent={
        canLoadOlder ? (
          <View className="items-center py-2">
            <Button
              size="sm"
              variant="ghost"
              onPress={() => void handleLoadOlderMessages()}
              disabled={olderHistoryState === 'loading'}>
              <Text>{olderHistoryState === 'loading' ? 'Loading…' : 'Load older messages'}</Text>
            </Button>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View className="items-center py-10">
          <Text className="text-muted-foreground text-sm">
            {historyState === 'loading' ? 'Loading messages…' : 'No messages yet.'}
          </Text>
        </View>
      }
    />
  );
}
