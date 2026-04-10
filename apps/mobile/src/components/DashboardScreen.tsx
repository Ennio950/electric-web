import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/src/theme';

type DashboardStat = {
  label: string;
  value: number;
  icon?: ReactNode;
};

type DashboardScreenProps = {
  title: string;
  subtitle: string;
  role: string;
  companyName: string;
  stats: DashboardStat[];
  isLoading?: boolean;
  errorMessage?: string | null;
  footer?: ReactNode;
};

export function DashboardScreen(props: DashboardScreenProps) {
  const { title, subtitle, role, companyName, stats, isLoading, errorMessage, footer } = props;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={Boolean(isLoading)} onRefresh={() => undefined} />}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{role.toUpperCase()}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.company}>{companyName}</Text>
      </View>

      <View style={styles.grid}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.card}>
            {stat.icon ? <View style={styles.cardIcon}>{stat.icon}</View> : null}
            <Text style={styles.cardValue}>{stat.value}</Text>
            <Text style={styles.cardLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.error}>{errorMessage}</Text>
        </View>
      ) : null}
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
    padding: 20,
    gap: 20,
  },
  hero: {
    borderRadius: radii.hero,
    backgroundColor: colors.navy,
    padding: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.accent,
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 30,
    fontWeight: '800',
    color: colors.textOnDark,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSubtleOnDark,
  },
  company: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: radii.xxl,
    backgroundColor: colors.cardBg,
    padding: 18,
  },
  cardIcon: {
    marginBottom: spacing.xs,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.navy,
  },
  cardLabel: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorBanner: {
    backgroundColor: colors.errorBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
  footer: {
    borderRadius: radii.xxl,
    backgroundColor: colors.cardBg,
    padding: 18,
  },
});
