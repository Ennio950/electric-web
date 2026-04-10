import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

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
    backgroundColor: '#F4F7FB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10233F',
  },
  link: {
    marginTop: 16,
    fontSize: 16,
    color: '#0B5FFF',
  },
});
