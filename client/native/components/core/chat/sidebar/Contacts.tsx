import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  removeContactAliasAction,
  startDirectConversationAction,
  updateContactAliasAction,
} from '@/lib/chat/chat.actions';
import { useContactsStore } from '@/store';
import type { ContactEntry } from '@/types';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';

function contactName(contact: ContactEntry): string {
  return contact.alias || contact.user.displayName || contact.user.username || 'Unknown';
}

/** Contacts list panel: message, edit alias, or remove a saved contact. */
export function Contacts() {
  const contacts = useContactsStore((state) => state.contacts);
  const status = useContactsStore((state) => state.status);
  const [editing, setEditing] = useState<ContactEntry | null>(null);
  const [alias, setAlias] = useState('');
  const [pending, setPending] = useState(false);

  function openEditor(contact: ContactEntry) {
    setEditing(contact);
    setAlias(contact.alias ?? '');
  }

  async function saveAlias() {
    if (!editing) {
      return;
    }
    setPending(true);
    try {
      await updateContactAliasAction(editing.user.id, alias.trim() || null);
      setEditing(null);
    } finally {
      setPending(false);
    }
  }

  function confirmRemove(contact: ContactEntry) {
    Alert.alert('Remove contact', `Remove ${contactName(contact)} from contacts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removeContactAliasAction(contact.user.id),
      },
    ]);
  }

  if (contacts.length === 0) {
    return (
      <View className="items-center px-4 py-10">
        <Text className="text-muted-foreground text-sm">
          {status === 'loading' ? 'Loading contacts…' : 'No contacts yet.'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView className="flex-1">
        {contacts.map((contact) => {
          const name = contactName(contact);
          return (
            <Pressable
              key={contact.user.id}
              onPress={() => void startDirectConversationAction({ walletAddress: contact.user.walletAddress })}
              onLongPress={() => openEditor(contact)}
              className="flex-row items-center gap-3 px-4 py-2">
              <Avatar alt={name} className="size-9">
                <AvatarFallback>
                  <Text className="text-xs">{name.slice(0, 2).toUpperCase()}</Text>
                </AvatarFallback>
              </Avatar>
              <View className="flex-1">
                <Text numberOfLines={1}>{name}</Text>
                {contact.user.username ? (
                  <Text className="text-muted-foreground text-xs">@{contact.user.username}</Text>
                ) : null}
              </View>
              <Button size="sm" variant="ghost" onPress={() => confirmRemove(contact)}>
                <Text>Remove</Text>
              </Button>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={Boolean(editing)} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background gap-3 rounded-t-2xl p-4">
            <Text variant="large">Edit alias</Text>
            <Input value={alias} onChangeText={setAlias} placeholder="Alias" autoFocus />
            <View className="flex-row justify-end gap-2">
              <Button variant="ghost" onPress={() => setEditing(null)}>
                <Text>Cancel</Text>
              </Button>
              <Button onPress={saveAlias} disabled={pending}>
                <Text>{pending ? 'Saving…' : 'Save'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
