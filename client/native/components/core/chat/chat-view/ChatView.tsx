import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useChatStore } from '@/store';
import { ArrowLeftIcon, InfoIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useChatShellContext } from '../chat-shell-context';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { TypingIndicator } from './TypingIndicator';

/** The active-conversation pane: header, messages, typing, composer. */
export function ChatView() {
  const { activeConversation, connectionState, peerOnline, setInfoPanelOpen } =
    useChatShellContext();
  const clearActiveConversation = () =>
    useChatStore.setState({ activeConversationId: null });

  if (!activeConversation) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-muted-foreground">Select a conversation to start chatting.</Text>
      </View>
    );
  }

  const subtitle =
    activeConversation.type === 'group'
      ? `${activeConversation.memberCount} members`
      : peerOnline
        ? 'Online'
        : connectionState === 'connected'
          ? 'Encrypted direct chat'
          : 'Connecting…';

  return (
    <View className="flex-1">
      <View className="border-border flex-row items-center gap-2 border-b px-2 py-3">
        <Button
          size="icon"
          variant="ghost"
          onPress={clearActiveConversation}
          accessibilityLabel="Back to conversations">
          <Icon as={ArrowLeftIcon} className="size-5" />
        </Button>
        <View className="flex-1">
          <Text numberOfLines={1} variant="large">
            {activeConversation.name}
          </Text>
          <Text className="text-muted-foreground text-xs">{subtitle}</Text>
        </View>
        <Button size="icon" variant="ghost" onPress={() => setInfoPanelOpen(true)}>
          <Icon as={InfoIcon} className="size-5" />
        </Button>
      </View>

      <View className="flex-1">
        <MessageList />
      </View>

      <TypingIndicator />
      <MessageInput />
    </View>
  );
}
