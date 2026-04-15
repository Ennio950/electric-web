import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { OfflineBanner } from '@/src/components/OfflineBanner';
import { AppProviders } from '@/src/providers/AppProviders';

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
