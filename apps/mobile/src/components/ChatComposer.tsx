import { StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { colors, radii, spacing } from '@/src/theme';

type ChatComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  isSending?: boolean;
  disabled?: boolean;
  canSend?: boolean;
  placeholder?: string;
};

export function ChatComposer(props: ChatComposerProps) {
  const {
    value,
    onChangeText,
    onSend,
    isSending = false,
    disabled = false,
    canSend = Boolean(value.trim()),
    placeholder = 'Escribe un mensaje',
  } = props;

  return (
    <View style={styles.container}>
      <TextInput
        accessibilityLabel={placeholder}
        multiline
        numberOfLines={3}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled && !isSending}
        blurOnSubmit={false}
      />
      <AppButton loading={isSending} disabled={disabled || !canSend} onPress={onSend}>
        Enviar mensaje
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    color: colors.navy,
    textAlignVertical: 'top',
  },
});
