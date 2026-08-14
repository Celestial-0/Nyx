import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { deleteGroupConversationAction, toggleConversationMuteAction } from '@/lib/chat/chat.actions';
import { Alert, ScrollView, View } from 'react-native';

import { useChatShellContext } from '../chat-shell-context';
import { MemberList } from './MemberList';

/** Conversation detail / members panel. */
export function InfoPanel() {
  const { activeConversation, activeContext, setInfoPanelOpen, handleLeaveGroup } =
    useChatShellContext();
  const conversation = activeConversation;

  if (!conversation) {
    return null;
  }

  const isGroup = conversation.type === 'group';
  const isAdmin = activeContext?.membership?.role === 'admin';
  const isMuted = Boolean(conversation.mutedUntil);

  const conversationId = conversation.id;

  function confirmDelete() {
    Alert.alert('Delete group', 'This permanently deletes the room for everyone. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteGroupConversationAction(conversationId);
          setInfoPanelOpen(false);
        },
      },
    ]);
  }

  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text variant="large">Details</Text>
        <Button variant="ghost" size="sm" onPress={() => setInfoPanelOpen(false)}>
          <Text>Close</Text>
        </Button>
      </View>
      <Separator />
      <ScrollView>
        <View className="gap-1 px-4 py-3">
          <Text variant="large">{conversation.name}</Text>
          {conversation.description ? (
            <Text className="text-muted-foreground text-sm">{conversation.description}</Text>
          ) : null}
        </View>
        <Separator />

        <View className="gap-2 px-4 py-3">
          <Button
            variant="outline"
            onPress={() => void toggleConversationMuteAction(conversation)}>
            <Text>{isMuted ? 'Unmute conversation' : 'Mute conversation'}</Text>
          </Button>

          {isGroup ? (
            <>
              <Button variant="outline" onPress={() => void handleLeaveGroup(conversation.id)}>
                <Text>Leave group</Text>
              </Button>
              {isAdmin ? (
                <Button variant="destructive" onPress={confirmDelete}>
                  <Text>Delete group</Text>
                </Button>
              ) : null}
            </>
          ) : null}
        </View>

        {isGroup ? (
          <>
            <Separator />
            <Text className="text-muted-foreground px-4 py-2 text-xs uppercase">Members</Text>
            <MemberList conversationId={conversation.id} canManage={isAdmin} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
