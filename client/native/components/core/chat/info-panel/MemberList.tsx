import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { updateGroupMemberRoleAction } from '@/lib/chat/chat.actions';
import { useChatStore } from '@/store';
import { Alert, Pressable, View } from 'react-native';

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '??';
}

/**
 * Member roster. When `canManage` (admin), long-pressing a member offers a
 * promote/demote action wired to `updateGroupMemberRoleAction`.
 */
export function MemberList({
  conversationId,
  canManage = false,
}: {
  conversationId: string;
  canManage?: boolean;
}) {
  const members = useChatStore((state) => state.membersByConversation[conversationId] ?? []);

  if (members.length === 0) {
    return <Text className="text-muted-foreground px-4 py-2 text-sm">No members loaded.</Text>;
  }

  function handleManage(memberId: string, memberRole: 'admin' | 'member' | null) {
    if (!canManage || !memberRole) {
      return;
    }
    const nextRole = memberRole === 'admin' ? 'member' : 'admin';
    Alert.alert(
      'Change role',
      `Make this member ${nextRole === 'admin' ? 'an admin' : 'a regular member'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () =>
            void updateGroupMemberRoleAction({
              roomId: conversationId,
              userId: memberId,
              role: nextRole,
            }),
        },
      ]
    );
  }

  return (
    <View className="gap-2 px-4 py-2">
      {members.map((member) => (
        <Pressable
          key={member.id}
          onLongPress={() => handleManage(member.id, member.memberRole)}
          className="flex-row items-center gap-3">
          <Avatar alt={member.name} className="size-9">
            <AvatarFallback>
              <Text className="text-xs">{initials(member.name)}</Text>
            </AvatarFallback>
          </Avatar>
          <View className="flex-1">
            <Text numberOfLines={1} className="font-medium">
              {member.name}
            </Text>
            <Text className="text-muted-foreground text-xs">
              {member.deviceCount} device{member.deviceCount === 1 ? '' : 's'}
            </Text>
          </View>
          {member.memberRole === 'admin' ? (
            <Badge variant="secondary">
              <Text>admin</Text>
            </Badge>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
