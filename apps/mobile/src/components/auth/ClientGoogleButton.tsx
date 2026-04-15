import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useClientGoogleAuth } from '@/src/hooks/useClientGoogleAuth';
import { radii, spacing } from '@/src/theme';

type ClientGoogleButtonProps = {
  disabled?: boolean;
};

export function ClientGoogleButton(props: ClientGoogleButtonProps) {
  const { disabled = false } = props;
  const { isSubmitting, startGoogleSignIn } = useClientGoogleAuth();
  const isDisabled = disabled || isSubmitting;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={() => void startGoogleSignIn()}
      style={({ pressed }) => [
        styles.googleButton,
        isDisabled ? styles.secondaryButtonDisabled : null,
        pressed && !isDisabled ? styles.googleButtonPressed : null,
      ]}
    >
      <View style={styles.googleBadge}>
        <Text style={styles.googleBadgeText}>G</Text>
      </View>
      {isSubmitting ? (
        <ActivityIndicator color="#111827" />
      ) : (
        <Text style={styles.googleButtonText}>Continuar con Google</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  googleButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.lg,
  },
  googleButtonPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  googleBadge: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: '#ffffff',
  },
  googleBadgeText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  secondaryButtonDisabled: {
    opacity: 0.55,
  },
});
