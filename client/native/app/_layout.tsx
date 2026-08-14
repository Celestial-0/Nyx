import '@/lib/polyfills';
import '@/global.css';

import { PaymentsSheet } from '@/components/core';
import { useAuthSession } from '@/hooks/useAuthSession';
import { NAV_THEME } from '@/lib/theme';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useUniwind } from 'uniwind';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const { theme } = useUniwind();

  // Bootstraps the persisted session (and warms the E2EE device cache) once
  // the store hydrates; keeps the access token fresh for the whole app.
  useAuthSession();

  return (
    <ThemeProvider value={NAV_THEME[theme ?? 'light']}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="chat" />
      </Stack>
      {/* Global payments sheet, openable from any screen. */}
      <PaymentsSheet />
      <PortalHost />
    </ThemeProvider>
  );
}
