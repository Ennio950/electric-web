import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/src/theme';

type FilterOption<T extends string> = {
  label: string;
  value: T;
};

type FilterChipsProps<T extends string> = {
  options: Array<FilterOption<T>>;
  value: T;
  onChange: (value: T) => void;
};

export function FilterChips<T extends string>({ options, value, onChange }: FilterChipsProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.chip, isActive ? styles.chipActive : null]}
          >
            <Text style={[styles.label, isActive ? styles.labelActive : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    backgroundColor: colors.cardBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
  },
});
