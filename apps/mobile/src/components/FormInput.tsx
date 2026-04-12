import { memo } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors, layout, radii, spacing } from '@/src/theme';

type FormInputProps = TextInputProps & {
  label?: string;
  error?: string | null;
};

export const FormInput = memo(function FormInput({ label, error, style, ...rest }: FormInputProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textPlaceholder}
        {...rest}
        style={[
          styles.input,
          rest.multiline ? styles.multiline : null,
          error ? styles.inputError : null,
          style,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.navyLabel,
  },
  input: {
    minHeight: layout.inputMinHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.navy,
  },
  multiline: {
    minHeight: layout.inputMinHeightMultiline,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    fontSize: 13,
    color: colors.error,
  },
});
