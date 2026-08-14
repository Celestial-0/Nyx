import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useLogout } from '@/hooks/useAuthSession';
import { openPaymentsPanelAction } from '@/hooks/usePayments';
import { useUserStore } from '@/store';
import type { UserConfig } from '@/types';
import { View } from 'react-native';

type ToggleKey = Exclude<keyof UserConfig, 'theme'>;

const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: 'notifications', label: 'Notifications' },
  { key: 'compactMode', label: 'Compact mode' },
  { key: 'autoConnectWallet', label: 'Auto-connect wallet' },
  { key: 'sharePresence', label: 'Share presence' },
];

/** User preferences + account actions. Preferences bind to `userStore.config`. */
export function Settings() {
  const config = useUserStore((state) => state.config);
  const setConfig = useUserStore((state) => state.setConfig);
  const { logout, isLoading } = useLogout();

  return (
    <View className="gap-1 px-4 py-3">
      <Text variant="large">Settings</Text>
      <Separator className="my-2" />
      {TOGGLES.map((toggle) => (
        <View key={toggle.key} className="flex-row items-center justify-between py-2">
          <Text>{toggle.label}</Text>
          <Switch
            checked={config[toggle.key]}
            onCheckedChange={(value) => setConfig({ [toggle.key]: value })}
          />
        </View>
      ))}

      <Separator className="my-2" />
      <Button
        variant="outline"
        onPress={() => openPaymentsPanelAction({ source: 'settings' })}>
        <Text>Manage credits</Text>
      </Button>
      <Button variant="destructive" className="mt-2" onPress={() => void logout()} disabled={isLoading}>
        <Text>{isLoading ? 'Signing out…' : 'Sign out'}</Text>
      </Button>
    </View>
  );
}
