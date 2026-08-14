import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useState } from 'react';
import { Modal, View } from 'react-native';

import { useChatShellContext } from '../chat-shell-context';

/** Create a new encrypted group room. */
export function GroupRoomDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { handleCreateGroup } = useChatShellContext();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setPending(true);
    setError(null);
    try {
      await handleCreateGroup();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-background gap-3 rounded-t-2xl p-4">
          <Text variant="large">New group</Text>
          <Text className="text-muted-foreground text-sm">
            Create an encrypted group room. You can invite members afterwards from the info panel.
          </Text>
          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
          <View className="flex-row justify-end gap-2">
            <Button variant="ghost" onPress={onClose}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={handleCreate} disabled={pending}>
              <Text>{pending ? 'Creating…' : 'Create group'}</Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
