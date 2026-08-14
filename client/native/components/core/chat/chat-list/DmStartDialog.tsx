import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useState } from 'react';
import { Modal, View } from 'react-native';

import { useChatShellContext } from '../chat-shell-context';

/** Start a direct conversation by username or wallet address. */
export function DmStartDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { startDirectConversation } = useChatShellContext();
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!value.trim()) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const isWallet = value.trim().length >= 32;
      await startDirectConversation(
        isWallet ? { walletAddress: value.trim() } : { username: value.trim() }
      );
      setValue('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-background gap-3 rounded-t-2xl p-4">
          <Text variant="large">New direct message</Text>
          <Input
            value={value}
            onChangeText={setValue}
            placeholder="Username or wallet address"
            autoCapitalize="none"
            autoFocus
          />
          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
          <View className="flex-row justify-end gap-2">
            <Button variant="ghost" onPress={onClose}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={handleStart} disabled={pending || !value.trim()}>
              <Text>{pending ? 'Starting…' : 'Start'}</Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
