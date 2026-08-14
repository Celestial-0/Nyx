import { Separator } from '@/components/ui/separator';
import { BellIcon, MessagesSquareIcon, SettingsIcon, UsersIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Contacts } from './Contacts';
import { Notifications } from './Notifications';
import { Settings } from './Settings';
import { SidebarItem } from './SidebarItem';
import { SidebarProfile } from './SidebarProfile';

type SidebarTab = 'chats' | 'contacts' | 'notifications' | 'settings';

/**
 * Navigation drawer hosting profile, contacts, notifications, and settings.
 * Presented as a left-anchored modal; `onClose` dismisses it, and selecting
 * "Chats" closes back to the conversation list.
 */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<SidebarTab>('chats');

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 flex-row">
        <View className="bg-background w-4/5 max-w-sm flex-1">
          <SidebarProfile />
          <Separator />
          <View className="gap-1 p-2">
            <SidebarItem
              icon={MessagesSquareIcon}
              label="Chats"
              active={tab === 'chats'}
              onPress={() => {
                setTab('chats');
                onClose();
              }}
            />
            <SidebarItem
              icon={UsersIcon}
              label="Contacts"
              active={tab === 'contacts'}
              onPress={() => setTab('contacts')}
            />
            <SidebarItem
              icon={BellIcon}
              label="Notifications"
              active={tab === 'notifications'}
              onPress={() => setTab('notifications')}
            />
            <SidebarItem
              icon={SettingsIcon}
              label="Settings"
              active={tab === 'settings'}
              onPress={() => setTab('settings')}
            />
          </View>
          <Separator />
          <View className="flex-1">
            {tab === 'contacts' ? <Contacts /> : null}
            {tab === 'notifications' ? <Notifications /> : null}
            {tab === 'settings' ? <Settings /> : null}
          </View>
        </View>
        {/* Tap the scrim to dismiss. */}
        <Pressable className="flex-1 bg-black/50" onPress={onClose} />
      </View>
    </Modal>
  );
}
