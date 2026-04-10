import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { SkeletonCard } from '@/src/components/SkeletonBox';
import { colors, layout } from '@/src/theme';

type LoadingScreenProps = {
  label?: string;
  variant?: 'spinner' | 'skeleton';
};

export function LoadingScreen({ label = 'Cargando...', variant = 'spinner' }: LoadingScreenProps) {
  if (variant === 'skeleton') {
    return (
      <View style={styles.skeletonContainer}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.pageBg,
  },
  label: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  skeletonContainer: {
    flex: 1,
    backgroundColor: colors.pageBg,
    padding: layout.containerPadding,
    gap: layout.sectionGap,
  },
});
