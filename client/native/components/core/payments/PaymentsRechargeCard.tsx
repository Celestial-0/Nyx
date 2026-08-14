import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { rechargeCreditsAction } from '@/hooks/usePayments';
import { cn } from '@/lib/utils';
import { usePaymentsStore } from '@/store';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

const PRESETS = ['0.25', '0.5', '1'];

/**
 * Recharge card. Builds + signs + submits a real SOL transfer through the
 * Mobile Wallet Adapter, then verifies the tx hash on the backend
 * (`rechargeCreditsAction`).
 */
export function PaymentsRechargeCard() {
  const rechargeState = usePaymentsStore((state) => state.rechargeState);
  const rechargeError = usePaymentsStore((state) => state.rechargeError);
  const snapshot = usePaymentsStore((state) => state.snapshot);
  const [amount, setAmount] = useState('0.25');

  const busy = rechargeState === 'sending' || rechargeState === 'verifying';
  const creditsPerSol = snapshot?.pricing.creditsPerSol ?? 0;
  const estimatedCredits = Math.floor((Number(amount) || 0) * creditsPerSol);

  async function handleRecharge() {
    if (busy || !amount.trim()) {
      return;
    }
    try {
      await rechargeCreditsAction(amount);
    } catch {
      // Error is surfaced via the payments store.
    }
  }

  const label =
    rechargeState === 'sending'
      ? 'Confirm in wallet…'
      : rechargeState === 'verifying'
        ? 'Verifying…'
        : 'Recharge';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add credits</CardTitle>
        <CardDescription>Send SOL to top up your balance.</CardDescription>
      </CardHeader>
      <CardContent className="gap-3">
        <View className="flex-row gap-2">
          {PRESETS.map((preset) => (
            <Pressable
              key={preset}
              onPress={() => setAmount(preset)}
              className={cn(
                'flex-1 items-center rounded-md border py-2',
                amount === preset ? 'border-primary bg-accent' : 'border-border'
              )}>
              <Text className="text-sm">{preset} SOL</Text>
            </Pressable>
          ))}
        </View>

        <Input
          value={amount}
          onChangeText={setAmount}
          placeholder="Amount in SOL"
          keyboardType="decimal-pad"
        />

        {creditsPerSol > 0 ? (
          <Text className="text-muted-foreground text-xs">
            ≈ {estimatedCredits} credits
          </Text>
        ) : null}

        <Button disabled={busy || !amount.trim()} onPress={handleRecharge}>
          <Text>{label}</Text>
        </Button>

        {rechargeError ? <Text className="text-destructive text-sm">{rechargeError}</Text> : null}
      </CardContent>
    </Card>
  );
}
