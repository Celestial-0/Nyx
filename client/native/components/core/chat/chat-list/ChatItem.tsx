import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { ChatConversation } from '@/types';
import { Pressable, View } from 'react-native';

import { useChatShellContext } from '../chat-shell-context';

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '??';
}

/** A single conversation row in the chat list. */
export function ChatItem({ conversation }: { conversation: ChatConversation }) {
  const { activeConversation, handleSelectConversation } = useChatShellContext();
  const isActive = conversation.id === activeConversation?.id;

  return (
    <Pressable
      onPress={() => handleSelectConversation(conversation.id)}
      className={cn('flex-row items-center gap-3 px-4 py-3', isActive && 'bg-accent')}>
      <Avatar alt={conversation.name} className="size-11">
        <AvatarFallback>
          <Text className="text-sm">{initials(conversation.name)}</Text>
        </AvatarFallback>
      </Avatar>

      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text numberOfLines={1} className="flex-1 font-medium">
            {conversation.name}
          </Text>
          <Text className="text-muted-foreground ml-2 text-xs">
            {conversation.lastActivityLabel}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text
            numberOfLines={1}
            className={cn(
              'flex-1 text-sm text-muted-foreground',
              conversation.lastMessagePreviewFallback && 'italic'
            )}>
            {conversation.lastMessagePreview}
          </Text>
          {conversation.unreadCount > 0 ? (
            <Badge className="ml-2">
              <Text>{conversation.unreadCount}</Text>
            </Badge>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
