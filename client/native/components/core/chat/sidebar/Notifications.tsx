import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { BellIcon } from 'lucide-react-native';
import { View } from 'react-native';

/**
 * Notifications panel.
 *
 * The backend exposes no notifications feed endpoint (see the API contract);
 * realtime presence/typing/message events are surfaced directly in the chat
 * view instead. This panel is an honest empty-state until such an endpoint
 * exists — it is not a placeholder for unfinished client work.
 */
export function Notifications() {
  return (
    <View className="items-center gap-2 px-4 py-10">
      <Icon as={BellIcon} className="text-muted-foreground size-8" />
      <Text className="text-muted-foreground text-center text-sm">
        You're all caught up. New messages appear in your chats in real time.
      </Text>
    </View>
  );
}
