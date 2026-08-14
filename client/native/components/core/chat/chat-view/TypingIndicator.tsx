import { Text } from '@/components/ui/text';
import { View } from 'react-native';

import { useChatShellContext } from '../chat-shell-context';

/** Shows "N people typing…" for the active conversation, or nothing. */
export function TypingIndicator() {
  const { typingNames } = useChatShellContext();

  if (typingNames.length === 0) {
    return null;
  }

  const label =
    typingNames.length === 1
      ? `${typingNames[0]} is typing…`
      : `${typingNames.length} people are typing…`;

  return (
    <View className="px-4 py-1">
      <Text className="text-muted-foreground text-xs italic">{label}</Text>
    </View>
  );
}
