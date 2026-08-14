import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { signInWithWallet } from '@/lib/auth';
import { useAuthStore } from '@/store';
import { useCallback } from 'react';
import { View } from 'react-native';

/**
 * Wallet sign-in entry point.
 *
 * Runs the full Mobile Wallet Adapter flow: authorize → request nonce → sign →
 * register the local E2EE device → verify with the backend. All state lives in
 * the auth store; `signInWithWallet` orchestrates it (see `lib/auth.ts`).
 */
export function WalletAuth() {
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const isLoading = useAuthStore((state) => state.isLoading);

  const handleConnect = useCallback(async () => {
    try {
      await signInWithWallet();
    } catch {
      // Error is surfaced via the auth store; nothing else to do here.
    }
  }, []);

  return (
    <View className="flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Welcome to Nyx</CardTitle>
          <CardDescription>Connect your Solana wallet to start chatting securely.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          <Button disabled={isLoading} onPress={handleConnect}>
            <Text>{isLoading ? 'Connecting…' : 'Connect wallet'}</Text>
          </Button>
          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
          <Text className="text-muted-foreground text-center text-xs">
            You'll be asked to approve the connection in your wallet app.
          </Text>
        </CardContent>
      </Card>
    </View>
  );
}
