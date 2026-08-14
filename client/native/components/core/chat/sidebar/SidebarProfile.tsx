import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { openPaymentsPanelAction } from '@/hooks/usePayments';
import { useUserStore } from '@/store';
import { Pressable, View } from 'react-native';

function shortenWallet(wallet: string): string {
  return wallet.length > 10 ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : wallet;
}

/** Current-user summary; tapping opens the payments panel. */
export function SidebarProfile() {
  const profile = useUserStore((state) => state.profile);

  const name = profile?.displayName || profile?.username || 'Not signed in';
  const subtitle = profile ? shortenWallet(profile.walletAddress) : 'Connect a wallet';

  return (
    <Pressable
      onPress={() => openPaymentsPanelAction({ source: 'profile' })}
      className="flex-row items-center gap-3 px-3 py-3">
      <Avatar alt={name} className="size-10">
        <AvatarFallback>
          <Text className="text-sm">{name.slice(0, 2).toUpperCase()}</Text>
        </AvatarFallback>
      </Avatar>
      <View className="flex-1">
        <Text numberOfLines={1} className="font-medium">
          {name}
        </Text>
        <Text className="text-muted-foreground text-xs">{subtitle}</Text>
      </View>
    </Pressable>
  );
}
