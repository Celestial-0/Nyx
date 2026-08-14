import { WalletAuth } from '@/components/core';
import { ProfileOnboardingDialog } from '@/components/core';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useCurrentUser } from '@/hooks/useUserProfile';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

/**
 * Auth screen: wallet sign-in, then (if the profile is incomplete) onboarding.
 *
 * - unauthenticated → WalletAuth (MWA connect)
 * - authenticated + no profile → ProfileOnboardingDialog
 * - authenticated + profile → redirect to /chat
 */
export default function AuthScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthSession();
  const profile = useCurrentUser();

  useEffect(() => {
    if (isAuthenticated && profile) {
      router.replace('/chat' as any);
    }
  }, [isAuthenticated, profile, router]);

  if (!isAuthenticated) {
    return <WalletAuth />;
  }

  if (!profile) {
    return (
      <View className="flex-1 justify-center">
        <ProfileOnboardingDialog onDone={() => router.replace('/chat' as any)} />
      </View>
    );
  }

  return null;
}
