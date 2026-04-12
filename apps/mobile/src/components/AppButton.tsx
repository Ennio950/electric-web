import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, layout, radii } from '@/src/theme';

type AppButtonProps = PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}>;

const SIZE_CONFIG = {
  sm: { minHeight: layout.buttonMinHeightSm, borderRadius: radii.md, px: 12, fontSize: 13 },
  md: { minHeight: layout.buttonMinHeight, borderRadius: radii.lg, px: 18, fontSize: 15 },
  lg: { minHeight: layout.buttonMinHeightLg, borderRadius: radii.lg, px: 24, fontSize: 16 },
} as const;

export function AppButton(props: AppButtonProps) {
  const { children, onPress, disabled = false, loading = false, tone = 'primary', size = 'md', icon } = props;
  const isDisabled = disabled || loading;
  const cfg = SIZE_CONFIG[size];

  const spinnerColor = tone === 'secondary' ? colors.navy : colors.textOnDark;
  const labelColor = tone === 'secondary' ? colors.navy : colors.textOnDark;

  const handlePress = () => {
    if (tone === 'danger') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        { minHeight: cfg.minHeight, borderRadius: cfg.borderRadius, paddingHorizontal: cfg.px },
        tone === 'secondary' ? styles.secondary : null,
        tone === 'danger' ? styles.danger : null,
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : icon ? (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.label, { fontSize: cfg.fontSize, color: labelColor }]}>{children}</Text>
        </View>
      ) : (
        <Text style={[styles.label, { fontSize: cfg.fontSize, color: labelColor }]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.cardBg,
  },
  danger: {
    backgroundColor: colors.error,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  label: {
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
