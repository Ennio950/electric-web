import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { OfflineBanner } from '@/src/components/OfflineBanner';
import { initSentry } from '@/src/lib/sentry';
import { AppProviders } from '@/src/providers/AppProviders';

// Initialize Sentry before any rendering.
// Reads DSN from EXPO_PUBLIC_SENTRY_DSN; stays disabled when unset (development).
initSentry();

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <OfflineBanner />
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </AppProviders>
  );
}
