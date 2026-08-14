import { useChatRealtime } from '@/hooks/useChatRealtime';
import { useChatShell } from '@/hooks/useChatShell';
import { View } from 'react-native';

import { ChatShellProvider } from './chat-shell-context';
import { ChatList } from './chat-list/ChatList';
import { ChatView } from './chat-view/ChatView';
import { InfoPanel } from './info-panel/InfoPanel';

/**
 * Top-level chat screen composition.
 *
 * Mounts the realtime socket, builds the shared shell (handlers + derived
 * state), and switches between the conversation list, the active conversation,
 * and the info panel one full-screen pane at a time (mobile layout).
 */
export function Chat() {
  useChatRealtime();
  const shell = useChatShell();

  return (
    <ChatShellProvider value={shell}>
      <View className="bg-background flex-1">
        {shell.isInfoPanelOpen ? (
          <InfoPanel />
        ) : shell.activeConversation ? (
          <ChatView />
        ) : (
          <ChatList />
        )}
      </View>
    </ChatShellProvider>
  );
}

export default Chat;
