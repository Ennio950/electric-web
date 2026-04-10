import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/EmptyState';
import { PressableCard } from '@/src/components/PressableCard';
import { SectionCard } from '@/src/components/SectionCard';
import { SignOutButton } from '@/src/components/SignOutButton';
import { StatusBadge } from '@/src/components/StatusBadge';
import { formatDateTime } from '@/src/lib/formatters';
import { useMobileHomeQuery, useEmployeeRequestsQuery, useEmployeeEmergencyCallsQuery } from '@/src/hooks/useMobileDataQueries';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';
import type { MarketplaceEmergencyCall, MarketplaceRequest, MobileHomeResponse } from '@/src/types/api';

export default function EmployeeHomeScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const homeQuery = useMobileHomeQuery();
  const requestsQuery = useEmployeeRequestsQuery('home');
  const emergenciesQuery = useEmployeeEmergencyCallsQuery('home');

  if (!bootstrap) {
    return null;
  }

  const data = homeQuery.data as MobileHomeResponse | undefined;
  const summary = data && data.role === 'employee' ? data.summary : null;
  
  const recentRequests = (requestsQuery.data ?? []).slice(0, 3);
  const activeEmergencies = (emergenciesQuery.data ?? [])
    .filter((call) => call.status !== 'completed')
    .slice(0, 3);

  const onRefresh = () => {
    void Promise.all([
      homeQuery.refetch(),
      requestsQuery.refetch(),
      emergenciesQuery.refetch(),
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={
            homeQuery.isRefetching
            || requestsQuery.isRefetching
            || emergenciesQuery.isRefetching
          }
          onRefresh={onRefresh}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>TÉCNICO</Text>
        <Text style={styles.title}>¡Hola, {bootstrap.user.displayName || 'técnico'}!</Text>
        <Text style={styles.subtitle}>Gestiona tus servicios asignados y emergencias activas.</Text>
        <Text style={styles.company}>{bootstrap.companyConfig.companyName}</Text>
      </View>

      <View style={styles.grid}>
        <StatCard icon="📋" label="Mis servicios" value={summary?.assignedRequests ?? 0} />
        <StatCard icon="🚨" label="Emergencias" value={summary?.activeEmergencyCount ?? 0} />
      </View>

      <SectionCard title="Atajos" subtitle="Acceso rápido a tu operación diaria.">
        <View style={styles.stack}>
          <PressableCard
            eyebrow="Queue"
            title="Ver mis solicitudes"
            subtitle="Servicios asignados y disponibles."
            onPress={() => pushAppRoute(appRoutes.employeeRequests)}
          />
          <PressableCard
            eyebrow="Urgente"
            title="Ver emergencias"
            subtitle="Atención de casos críticos asignados."
            onPress={() => pushAppRoute(appRoutes.employeeEmergencyNew)}
          />
          <PressableCard
            eyebrow="Perfil"
            title="Mi perfil público"
            subtitle="Gestiona tu foto y datos de contacto."
            onPress={() => pushAppRoute(appRoutes.employeeProfile)}
          />
          {bootstrap.featureFlags.builderMobile ? (
            <PressableCard
              eyebrow="Builder"
              title="Abrir estimator"
              subtitle="Calculadora de materiales y recetas."
              onPress={() => pushAppRoute(appRoutes.builderHome)}
            />
          ) : null}
        </View>
      </SectionCard>

      <SectionCard title="Servicios asignados" subtitle="Tus próximos trabajos programados.">
        {requestsQuery.isLoading ? <Text style={styles.muted}>Cargando servicios...</Text> : null}
        {recentRequests.length ? (
          <View style={styles.stack}>
            {recentRequests.map((request) => (
              <RequestPreviewCard
                key={request.id}
                request={request}
                locale={bootstrap.companyConfig.locale}
                timezone={bootstrap.companyConfig.timezone}
                onPress={() => pushAppRoute(appRoutes.employeeRequestDetail(request.id))}
              />
            ))}
          </View>
        ) : null}
        {!requestsQuery.isLoading && !recentRequests.length ? (
          <EmptyState
            icon="📋"
            title="Sin servicios"
            subtitle="No tienes servicios asignados actualmente."
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Emergencias activas" subtitle="Reportes críticos que requieren tu atención.">
        {emergenciesQuery.isLoading ? <Text style={styles.muted}>Cargando emergencias...</Text> : null}
        {activeEmergencies.length ? (
          <View style={styles.stack}>
            {activeEmergencies.map((call) => (
              <EmergencyPreviewCard
                key={call.id}
                call={call}
                locale={bootstrap.companyConfig.locale}
                timezone={bootstrap.companyConfig.timezone}
                onPress={() => pushAppRoute(appRoutes.employeeEmergencyDetail(call.id))}
              />
            ))}
          </View>
        ) : null}
        {!emergenciesQuery.isLoading && !activeEmergencies.length ? (
          <EmptyState
            icon="🚨"
            title="Sin emergencias"
            subtitle="No tienes emergencias asignadas ahora mismo."
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Sesión">
        <SignOutButton />
      </SectionCard>
    </ScrollView>
  );
}

function StatCard(props: { icon: string; label: string; value: number }) {
  const { icon, label, value } = props;
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RequestPreviewCard(props: {
  request: MarketplaceRequest;
  locale: string;
  timezone: string;
  onPress: () => void;
}) {
  const { request, locale, timezone, onPress } = props;
  return (
    <PressableCard
      title={request.address || 'Solicitud'}
      subtitle={request.description || 'Sin descripción'}
      meta={formatDateTime(request.updatedAt || request.createdAt, locale, timezone)}
      onPress={onPress}
    >
      <StatusBadge status={request.status} type="request" />
    </PressableCard>
  );
}

function EmergencyPreviewCard(props: {
  call: MarketplaceEmergencyCall;
  locale: string;
  timezone: string;
  onPress: () => void;
}) {
  const { call, locale, timezone, onPress } = props;
  return (
    <PressableCard
      title={call.location || 'Emergencia'}
      subtitle={call.issue || 'Sin detalle'}
      meta={formatDateTime(call.updatedAt || call.createdAt, locale, timezone)}
      onPress={onPress}
    >
      <StatusBadge status={call.status} type="emergency" />
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  content: { padding: spacing.xl, gap: spacing.lg },
  hero: { borderRadius: radii.hero, backgroundColor: colors.navy, padding: spacing.xxl },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.accent },
  title: { marginTop: spacing.sm, fontSize: 30, fontWeight: '800', color: colors.textOnDark },
  subtitle: { marginTop: spacing.sm, fontSize: 15, lineHeight: 22, color: colors.textSubtleOnDark },
  company: { marginTop: 18, fontSize: 14, fontWeight: '700', color: colors.textOnDark },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCard: { minWidth: '47%', flexGrow: 1, borderRadius: radii.xxl, backgroundColor: colors.cardBg, padding: 18 },
  statIcon: { fontSize: 22, marginBottom: spacing.xs },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.navy },
  statLabel: { marginTop: spacing.xs, fontSize: 13, color: colors.textSecondary },
  stack: { gap: spacing.md },
  muted: { fontSize: 14, color: colors.textMuted },
});
