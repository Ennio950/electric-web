import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '@/src/providers/AppProviders';
import { initSentry } from '@/src/lib/sentry';

// Initialize Sentry once at startup (no-ops when EXPO_PUBLIC_SENTRY_DSN is not set).
initSentry();

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Slot />
    </AppProviders>
  );
}
