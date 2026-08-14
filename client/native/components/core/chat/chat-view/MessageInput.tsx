import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { SendIcon } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { useChatShellContext } from '../chat-shell-context';

/**
 * Message composer. Encrypts + sends via the chat shell's `handleSendMessage`
 * (which builds the E2EE envelope and emits `chat:message:send`).
 */
export function MessageInput() {
  const {
    draftMessage,
    setDraftMessage,
    composerLocked,
    composerNotice,
    handleSendMessage,
    handleComposerBlur,
  } = useChatShellContext();
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (composerLocked || sending || !draftMessage.trim()) {
      return;
    }
    setSending(true);
    try {
      await handleSendMessage();
    } finally {
      setSending(false);
    }
  }

  const disabled = composerLocked || sending || !draftMessage.trim();

  return (
    <View className="border-border border-t p-2">
      {composerNotice ? (
        <Text className="text-muted-foreground px-2 pb-1 text-xs">{composerNotice}</Text>
      ) : null}
      <View className="flex-row items-center gap-2">
        <Input
          value={draftMessage}
          onChangeText={setDraftMessage}
          onBlur={handleComposerBlur}
          placeholder={composerLocked ? 'Secure channel not ready' : 'Message'}
          editable={!composerLocked}
          className="flex-1"
          multiline
          onSubmitEditing={handleSend}
        />
        <Button size="icon" onPress={handleSend} disabled={disabled}>
          <Icon as={SendIcon} className="size-5" />
        </Button>
      </View>
    </View>
  );
}
