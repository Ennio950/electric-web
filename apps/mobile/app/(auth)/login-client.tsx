import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { RoleLoginScreen } from '@/src/components/auth/RoleLoginScreen';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { radii, spacing } from '@/src/theme';

type ClientGoogleButtonProps = {
  disabled?: boolean;
};

let ClientGoogleButtonImpl: React.ComponentType<ClientGoogleButtonProps> | null = null;
let clientGoogleLoadError: string | null = null;

try {
  const loadedModule = require('../../src/components/auth/ClientGoogleButton');
  ClientGoogleButtonImpl = loadedModule.ClientGoogleButton as React.ComponentType<ClientGoogleButtonProps>;
} catch (error) {
  clientGoogleLoadError = error instanceof Error ? error.message : 'No se pudo cargar Google Sign-In.';
}

export default function ClientLoginScreen() {
  const setNotice = useSessionStore((state) => state.setNotice);

  return (
    <RoleLoginScreen
      accentColor="#f5b800"
      backAccentColor="#f5c842"
      backHref={appRoutes.authLogin}
      cardBorderColor="rgba(245, 200, 66, 0.28)"
      emailPlaceholder="cliente@ejemplo.com"
      header={(
        <>
          <Text style={styles.clientEyebrow}>Acceso cliente</Text>
          <Text style={styles.clientTitle}>Straight Wire Electric</Text>
          <Text style={styles.clientSubtitle}>
            Ingresa para gestionar tus servicios, revisar avances y seguir tus solicitudes.
          </Text>
        </>
      )}
      logoHeight={104}
      logoWidth={220}
      passwordPlaceholder="Tu contrasena"
      primaryLabel="Iniciar sesion"
      primaryTextColor="#101114"
      secondaryContent={(
        <View style={styles.clientSecondary}>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>o continua con</Text>
            <View style={styles.dividerLine} />
          </View>

          {ClientGoogleButtonImpl ? (
            <ClientGoogleButtonImpl />
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setNotice(
                  `Google no esta disponible en esta build todavia. ${clientGoogleLoadError ?? ''}`.trim(),
                );
              }}
              style={({ pressed }) => [
                styles.googleButton,
                styles.secondaryButtonDisabled,
                pressed ? styles.googleButtonPressed : null,
              ]}
            >
              <View style={styles.googleBadge}>
                <Text style={styles.googleBadgeText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Continuar con Google</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={false}
            onPress={() => {
              setNotice(null);
              pushAppRoute(appRoutes.authMagicClient);
            }}
            style={({ pressed }) => [
              styles.magicButton,
              pressed ? styles.magicButtonPressed : null,
            ]}
          >
            <Text style={styles.magicButtonText}>Continuar con codigo magico</Text>
          </Pressable>
        </View>
      )}
      footerContent={(
        <View style={styles.clientFooter}>
          <Text style={styles.clientFooterText}>No tienes cuenta?</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setNotice(null);
              pushAppRoute(appRoutes.authSignupClient);
            }}
          >
            <Text style={styles.clientFooterLink}>Crear cuenta</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  clientEyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#f5c842',
  },
  clientTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#f8fafc',
  },
  clientSubtitle: {
    maxWidth: 320,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#cbd5e1',
  },
  clientSecondary: {
    gap: spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dividerLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#8f97a6',
  },
  magicButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: spacing.lg,
  },
  magicButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  magicButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
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
  clientFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  clientFooterText: {
    fontSize: 15,
    color: '#cbd5e1',
  },
  clientFooterLink: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f5c842',
    textDecorationLine: 'underline',
  },
});
