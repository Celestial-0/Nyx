import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Chat } from '@/components/core';
import { useAuthSession } from '@/hooks/useAuthSession';

/**
 * Protected chat screen.
 *
 * Redirects to / if the user is unauthenticated.
 */
export default function ChatScreen() {
  const router = useRouter();
  const { isAuthenticated, isHydrated, isLoading } = useAuthSession();

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace('/' as any);
    }
  }, [isHydrated, isAuthenticated, router]);

  if (isLoading || !isHydrated) {
    return null; // Or a global spinner
  }

  if (!isAuthenticated) {
    return null; // Wait for useEffect to redirect
  }

  return (
    <View className="flex-1">
      <Chat />
    </View>
  );
}
