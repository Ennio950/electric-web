import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthPortalLayout } from '@/src/components/auth/AuthPortalLayout';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionSnapshot, useSessionStore } from '@/src/stores/sessionStore';
import { radii, spacing } from '@/src/theme';

const LOGO = require('@/assets/images/logo.webp');

const ACCESS_CARDS = [
  {
    id: 'client',
    title: 'Cliente',
    description: 'Servicios, seguimiento y pagos desde el celular.',
    action: 'Acceso cliente',
    accentColor: '#f5c842',
    href: appRoutes.authClientLogin,
  },
  {
    id: 'employee',
    title: 'Empleado',
    description: 'Operacion diaria, solicitudes y trabajo de campo.',
    action: 'Acceso empleado',
    accentColor: '#22c55e',
    href: appRoutes.authEmployeeLogin,
  },
  {
    id: 'admin',
    title: 'Admin',
    description: 'Revision, aprobaciones y panel de control.',
    action: 'Acceso admin',
    accentColor: '#8b5cf6',
    href: appRoutes.authAdminLogin,
  },
] as const;

export default function LoginScreen() {
  const session = useSessionSnapshot();
  const setNotice = useSessionStore((state) => state.setNotice);

  return (
    <AuthPortalLayout>
      <View style={styles.shell}>
        <Image source={LOGO} resizeMode="contain" style={styles.logo} />

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Straight Wire Electric</Text>
          <Text style={styles.title}>Selecciona tu acceso</Text>
          <Text style={styles.subtitle}>
            Una sola app nativa para clientes, cuadrilla y administracion.
          </Text>
        </View>

        {session.notice ? (
          <View style={styles.noticeBanner}>
            <Text style={styles.noticeText}>{session.notice}</Text>
          </View>
        ) : null}

        <View style={styles.cardsGrid}>
          {ACCESS_CARDS.map((card) => (
            <Pressable
              key={card.id}
              accessibilityRole="button"
              onPress={() => {
                setNotice(null);
                pushAppRoute(card.href);
              }}
              style={({ pressed }) => [
                styles.card,
                { borderColor: `${card.accentColor}3d` },
                pressed ? styles.cardPressed : null,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.cardBadge, { backgroundColor: card.accentColor }]}>
                  <Text style={styles.cardBadgeText}>{card.title.charAt(0)}</Text>
                </View>
                <Text style={styles.cardTitle}>{card.title}</Text>
              </View>

              <Text style={styles.cardDescription}>{card.description}</Text>

              <View style={[styles.cardAction, { borderColor: `${card.accentColor}66` }]}>
                <Text style={[styles.cardActionText, { color: card.accentColor }]}>{card.action}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </AuthPortalLayout>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    maxWidth: 680,
    alignItems: 'center',
    gap: spacing.xl,
  },
  logo: {
    width: 190,
    height: 84,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: '#f5c842',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    color: '#f8fafc',
  },
  subtitle: {
    maxWidth: 360,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#cbd5e1',
  },
  noticeBanner: {
    width: '100%',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: 'rgba(127,29,29,0.22)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#fecaca',
  },
  cardsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 320,
    minHeight: 146,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: 'rgba(12, 10, 15, 0.84)',
    padding: spacing.lg,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 8,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ translateY: 1 }],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadgeText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0b0b0f',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#cbd5e1',
  },
  cardAction: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  cardActionText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
