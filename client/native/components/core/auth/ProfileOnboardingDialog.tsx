import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { saveCurrentUserProfile } from '@/lib/auth';
import { UpdateProfileSchema } from '@/types';
import { useState } from 'react';
import { View } from 'react-native';

/**
 * First-run profile setup (username + display name).
 * Validates input with `UpdateProfileSchema` and calls `saveCurrentUserProfile`.
 */
export function ProfileOnboardingDialog({ onDone }: { onDone?: () => void }) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    const parsed = UpdateProfileSchema.safeParse({
      username: username.trim() || undefined,
      fullName: fullName.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid profile');
      return;
    }

    setPending(true);
    setError(null);
    try {
      await saveCurrentUserProfile(parsed.data);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setPending(false);
    }
  }

  return (
    <View className="gap-3 p-4">
      <Text variant="large">Set up your profile</Text>
      <Input
        value={username}
        onChangeText={setUsername}
        placeholder="Username"
        autoCapitalize="none"
      />
      <Input value={fullName} onChangeText={setFullName} placeholder="Display name" />
      {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
      <Button onPress={handleSubmit} disabled={pending}>
        <Text>{pending ? 'Saving…' : 'Continue'}</Text>
      </Button>
    </View>
  );
}
