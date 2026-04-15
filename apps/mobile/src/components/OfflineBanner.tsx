import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import { colors, spacing } from '@/src/theme';

export const OfflineBanner = memo(function OfflineBanner() {
  const { isOffline } = useNetworkStatus();

  if (!isOffline) {
    return null;
  }

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>Sin conexion a internet</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warning,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textOnDark,
  },
});
