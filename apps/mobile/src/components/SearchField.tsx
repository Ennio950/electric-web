import { StyleSheet, TextInput } from 'react-native';

import { colors, layout, radii } from '@/src/theme';

type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
};

export function SearchField({ value, onChangeText, placeholder = 'Buscar' }: SearchFieldProps) {
  return (
    <TextInput
      autoCapitalize="none"
      autoCorrect={false}
      clearButtonMode="while-editing"
      placeholder={placeholder}
      placeholderTextColor={colors.textPlaceholder}
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: layout.inputMinHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.navy,
  },
});
