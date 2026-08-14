import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { usePaymentsStore } from '@/store';
import { View } from 'react-native';

/** Credit balance + pricing summary from the payments snapshot. */
export function PaymentsSummaryCard() {
  const snapshot = usePaymentsStore((state) => state.snapshot);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credits</CardTitle>
        <CardDescription>Your encrypted-message balance.</CardDescription>
      </CardHeader>
      <CardContent className="gap-1">
        <Text variant="h2">{snapshot ? snapshot.balance : '—'}</Text>
        {snapshot ? (
          <View className="gap-0.5">
            <Text className="text-muted-foreground text-xs">
              {snapshot.pricing.messageSendCredits} credits / message
            </Text>
            <Text className="text-muted-foreground text-xs">
              {snapshot.pricing.creditsPerSol} credits / SOL
            </Text>
          </View>
        ) : (
          <Text className="text-muted-foreground text-sm">No snapshot loaded.</Text>
        )}
      </CardContent>
    </Card>
  );
}
