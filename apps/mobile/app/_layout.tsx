import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AppProviders } from '@/src/providers/AppProviders';
import { initSentry } from '@/src/lib/sentry';

// Initialize Sentry once at startup (no-ops when EXPO_PUBLIC_SENTRY_DSN is not set).
initSentry();

// Show alert + play sound when a push notification arrives while the app is in the foreground.
// Must be called before any notification listener is registered.
// No-op on web and Expo Go (lazy import guards inside pushNotifications handle that).
if (Platform.OS !== 'web') {
  void import('expo-notifications').then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }).catch(() => undefined);
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <AppProviders>
      <StatusBar style="light" />
      <Slot />
    </AppProviders>
  );
}
