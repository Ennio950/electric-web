import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ruta no encontrada</Text>
      <Link href="/" style={styles.link}>
        Volver al inicio
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.pageBg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.navy,
  },
  link: {
    marginTop: spacing.lg,
    fontSize: 16,
    color: colors.primary,
  },
});
