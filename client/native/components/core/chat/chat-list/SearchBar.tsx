import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { useChatStore } from '@/store';
import { SearchIcon } from 'lucide-react-native';
import { View } from 'react-native';

/** Conversation search field bound to `chatStore.searchQuery`. */
export function SearchBar() {
  const searchQuery = useChatStore((state) => state.searchQuery);
  const setSearchQuery = useChatStore((state) => state.setSearchQuery);

  return (
    <View className="relative flex-row items-center px-4 py-2">
      <Icon as={SearchIcon} className="text-muted-foreground absolute left-7 size-4" />
      <Input
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search conversations"
        className="flex-1 pl-9"
        autoCapitalize="none"
      />
    </View>
  );
}
