import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/src/theme';

type QueryErrorBannerProps = {
  error: unknown;
  fallbackMessage?: string;
  onRetry?: () => void;
};

export function QueryErrorBanner({
  error,
  fallbackMessage = 'Ocurrio un error.',
  onRetry,
}: QueryErrorBannerProps) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : fallbackMessage;

  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Reintentar" onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryLabel}>Reintentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.errorBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  message: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
  },
  retryButton: {
    borderRadius: radii.sm,
    backgroundColor: colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textOnDark,
  },
});
