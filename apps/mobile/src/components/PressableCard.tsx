import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/src/theme';

type PressableCardProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  onPress?: () => void;
}>;

export function PressableCard(props: PressableCardProps) {
  const { eyebrow, title, subtitle, meta, onPress, children } = props;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {children ? <View style={styles.children}>{children}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    padding: 16,
    gap: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  children: {
    marginTop: 6,
  },
});
