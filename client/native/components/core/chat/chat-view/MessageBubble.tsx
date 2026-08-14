import { Text } from '@/components/ui/text';
import { deleteMessageAction, hideMessageAction } from '@/lib/chat/chat.actions';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';
import { Alert, Pressable, View } from 'react-native';

const DELIVERY_LABEL: Record<ChatMessage['deliveryState'], string> = {
  sending: 'Sending…',
  stored: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  rejected: 'Failed',
};

/**
 * A single message bubble. `isOwn` right-aligns and recolors the bubble.
 * Long-press opens hide (for me) / delete (for everyone, own messages only).
 */
export function MessageBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  function handleLongPress() {
    const options: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [
      { text: 'Hide for me', onPress: () => void hideMessageAction(message) },
    ];

    if (message.canDeleteForEveryone) {
      options.push({
        text: 'Delete for everyone',
        style: 'destructive',
        onPress: () => void deleteMessageAction(message),
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message', undefined, options);
  }

  return (
    <Pressable
      onLongPress={handleLongPress}
      className={cn(
        'my-1 max-w-[80%] rounded-2xl px-3 py-2',
        isOwn ? 'bg-primary self-end' : 'bg-muted self-start'
      )}>
      <Text
        className={cn(
          'text-sm',
          isOwn && 'text-primary-foreground',
          message.previewFallback && 'italic opacity-80'
        )}>
        {message.previewText}
      </Text>
      {isOwn ? (
        <Text
          className={cn(
            'mt-1 text-[10px]',
            message.deliveryState === 'rejected'
              ? 'text-destructive'
              : 'text-primary-foreground/70'
          )}>
          {DELIVERY_LABEL[message.deliveryState]}
        </Text>
      ) : null}
    </Pressable>
  );
}
