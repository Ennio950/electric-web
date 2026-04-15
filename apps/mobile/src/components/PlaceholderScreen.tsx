import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, layout, radii } from '@/src/theme';

type PlaceholderScreenProps = {
  title: string;
  subtitle: string;
  footer?: ReactNode;
};

export function PlaceholderScreen({ title, subtitle, footer }: PlaceholderScreenProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  content: {
    padding: layout.containerPadding,
    gap: layout.sectionGap,
  },
  card: {
    borderRadius: radii.xxxl,
    backgroundColor: colors.cardBg,
    padding: layout.cardPadding,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.navy,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  footer: {
    borderRadius: radii.xxxl,
    backgroundColor: colors.cardBg,
    padding: layout.cardPadding,
  },
});
