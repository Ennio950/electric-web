import { StyleSheet, Text } from 'react-native';

import { RoleLoginScreen } from '@/src/components/auth/RoleLoginScreen';
import { devBossCredentials } from '@/src/config/mobileEnv';
import { appRoutes } from '@/src/navigation/routes';
import { spacing } from '@/src/theme';

export default function AdminLoginScreen() {
  return (
    <RoleLoginScreen
      accentColor="#7c3aed"
      backAccentColor="#8b5cf6"
      backHref={appRoutes.authLogin}
      cardBorderColor="rgba(139, 92, 246, 0.26)"
      emailLabel="Email"
      initialEmail={__DEV__ ? devBossCredentials.email : undefined}
      initialPassword={__DEV__ ? devBossCredentials.password : undefined}
      emailPlaceholder="boss@straightwireelectric.com"
      header={(
        <>
          <Text style={styles.adminTitle}>
            PANEL <Text style={styles.adminTitleAccent}>JEFE</Text>
          </Text>
          <Text style={styles.adminSubtitle}>Acceso de administracion y auditoria.</Text>
        </>
      )}
      passwordPlaceholder="Tu contrasena"
      primaryLabel="Entrar"
      secondaryContent={<Text style={styles.adminFootnote}>Internal access only</Text>}
    />
  );
}

const styles = StyleSheet.create({
  adminTitle: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 1.6,
    textAlign: 'center',
    color: '#f8fafc',
  },
  adminTitleAccent: {
    color: '#8b5cf6',
  },
  adminSubtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#cbd5e1',
  },
  adminFootnote: {
    paddingTop: spacing.sm,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.6,
    textAlign: 'center',
    textTransform: 'uppercase',
    color: '#5f636d',
  },
});
