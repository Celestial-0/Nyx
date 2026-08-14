import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Landing } from '@/components/core/landing/Landing';
import { useAuthSession } from '@/hooks/useAuthSession';

/**
 * Root entry point for the Nyx app.
 *
 * Handles initial session check and redirects to /chat if already authenticated.
 */
export default function Screen() {
  const router = useRouter();
  const { isAuthenticated, isHydrated, isLoading } = useAuthSession();

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.replace('/chat' as any);
    }
  }, [isHydrated, isAuthenticated, router]);

  if (isLoading) {
    return null; // Or a global spinner
  }

  return (
    <Landing onGetStarted={() => router.push('/auth' as any)} />
  );
}
