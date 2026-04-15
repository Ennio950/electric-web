import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RoleLoginScreen } from '@/src/components/auth/RoleLoginScreen';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { spacing } from '@/src/theme';

export default function EmployeeLoginScreen() {
  const setNotice = useSessionStore((state) => state.setNotice);

  return (
    <RoleLoginScreen
      accentColor="#22c55e"
      backAccentColor="#22c55e"
      backHref={appRoutes.authLogin}
      cardBorderColor="rgba(34, 197, 94, 0.26)"
      emailPlaceholder="tecnico@electric.com"
      header={(
        <>
          <Text style={styles.employeeTitleLineOne}>INICIO DE SESION DEL</Text>
          <Text style={styles.employeeTitleLineTwo}>EMPLEADO</Text>
          <Text style={styles.employeeSubtitle}>Acceso interno y operativo para cuadrilla.</Text>
        </>
      )}
      passwordPlaceholder="Tu contrasena"
      primaryLabel="Iniciar sesion"
      secondaryContent={(
        <View style={styles.employeeFooter}>
          <View style={styles.employeeRecruitRow}>
            <Text style={styles.employeeRecruitText}>Quieres unirte?</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setNotice(null);
                pushAppRoute(appRoutes.authApplyEmployee);
              }}
            >
              <Text style={styles.employeeRecruitLink}>Solicitar empleo</Text>
            </Pressable>
          </View>

          <Text style={styles.employeeFootnote}>Solo acceso interno</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  employeeTitleLineOne: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 1.7,
    textAlign: 'center',
    color: '#22c55e',
  },
  employeeTitleLineTwo: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.8,
    textAlign: 'center',
    color: '#f8fafc',
  },
  employeeSubtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#cbd5e1',
  },
  employeeFooter: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
  employeeRecruitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  employeeRecruitText: {
    fontSize: 15,
    color: '#cbd5e1',
  },
  employeeRecruitLink: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4ade80',
    textDecorationLine: 'underline',
  },
  employeeFootnote: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#5f636d',
  },
});
