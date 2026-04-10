import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/theme';

type KeyValueListProps = {
  items: Array<{
    label: string;
    value: string;
  }>;
};

export function KeyValueList({ items }: KeyValueListProps) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.label} style={styles.row}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  row: {
    gap: spacing.xxs,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  value: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.navy,
  },
});
