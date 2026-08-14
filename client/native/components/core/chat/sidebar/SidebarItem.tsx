import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

/** A single icon+label entry in the sidebar navigation. */
export function SidebarItem({
  icon,
  label,
  active,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 rounded-md px-3 py-2',
        active ? 'bg-accent' : 'active:bg-accent/50'
      )}>
      <Icon as={icon} className={cn('size-5', active && 'text-foreground')} />
      <Text className={cn(active ? 'font-medium' : 'text-muted-foreground')}>{label}</Text>
    </Pressable>
  );
}
