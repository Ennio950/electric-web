import { Pressable, StyleSheet, Text } from 'react-native';
import { signOut } from 'firebase/auth';

import { auth } from '@/src/config/firebase';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii } from '@/src/theme';

export function SignOutButton() {
  const setNotice = useSessionStore((state) => state.setNotice);

  async function handlePress() {
    try {
      await signOut(auth);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cerrar sesion.';
      setNotice(message);
    }
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesion" onPress={handlePress} style={styles.button}>
      <Text style={styles.label}>Cerrar sesion</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.md,
    backgroundColor: colors.primaryPale,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
