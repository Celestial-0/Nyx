import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { usePaymentsStore } from '@/store';
import { View } from 'react-native';

/** Recent credit activity feed from the payments snapshot. */
export function PaymentsActivityCard() {
  const activity = usePaymentsStore((state) => state.snapshot?.recentActivity ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="gap-2">
        {activity.length === 0 ? (
          <Text className="text-muted-foreground text-sm">No activity yet.</Text>
        ) : (
          activity.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <Separator className="mb-2" /> : null}
              <View className="flex-row items-center justify-between">
                <Text numberOfLines={1} className="flex-1 text-sm">
                  {item.reason}
                </Text>
                <Text
                  className={cnChange(item.change)}>
                  {item.change > 0 ? `+${item.change}` : item.change}
                </Text>
              </View>
            </View>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function cnChange(change: number): string {
  return change >= 0 ? 'text-sm text-primary' : 'text-sm text-destructive';
}
