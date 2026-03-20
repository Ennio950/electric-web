import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/EmptyState';
import { PressableCard } from '@/src/components/PressableCard';
import { SectionCard } from '@/src/components/SectionCard';
import { SignOutButton } from '@/src/components/SignOutButton';
import { StatusBadge } from '@/src/components/StatusBadge';
import {
  fetchEmployeeRequests,
  fetchEmergencyCalls,
  withCurrentToken,
} from '@/src/lib/api';
import { formatDateTime } from '@/src/lib/formatters';
import { useMobileHomeQuery } from '@/src/hooks/useMobileHomeQuery';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';
import type { MarketplaceEmergencyCall, MarketplaceRequest } from '@/src/types/api';

export default function EmployeeHomeScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const homeQuery = useMobileHomeQuery();
  const myRequestsQuery = useQuery({
    queryKey: ['employee-home-requests'],
    queryFn: () => withCurrentToken(fetchEmployeeRequests),
  });
  const emergenciesQuery = useQuery({
    queryKey: ['employee-home-emergencies'],
    queryFn: () => withCurrentToken((token) => fetchEmergencyCalls(token)),
  });

  if (!bootstrap) {
    return null;
  }

  const summary = homeQuery.data?.role === 'employee' ? homeQuery.data.summary : null;
  const currentUserId = bootstrap.user.uid;
  const assignedEmergencies = (emergenciesQuery.data ?? [])
    .filter((call) => call.assignedEmployeeId === currentUserId)
    .slice(0, 3);
  const recentRequests = (myRequestsQuery.data ?? []).slice(0, 3);

  const onRefresh = () => {
    void Promise.all([homeQuery.refetch(), myRequestsQuery.refetch(), emergenciesQuery.refetch()]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={homeQuery.isRefetching || myRequestsQuery.isRefetching || emergenciesQuery.isRefetching}
          onRefresh={onRefresh}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>EMPLOYEE</Text>
        <Text style={styles.title}>Panel de campo</Text>
        <Text style={styles.subtitle}>Resumen del turno, atajos operativos y lo que tienes que atender ahora.</Text>
        <Text style={styles.company}>{bootstrap.companyConfig.companyName}</Text>
      </View>

      <View style={styles.grid}>
        <StatCard icon="📂" label="Requests abiertos" value={summary?.openRequests ?? 0} />
        <StatCard icon="👤" label="Asignados" value={summary?.assignedRequests ?? 0} />
        <StatCard icon="⚡" label="En progreso" value={summary?.inProgressRequests ?? 0} />
        <StatCard icon="🚨" label="Emergencias activas" value={summary?.activeEmergencyCount ?? 0} />
      </View>

      <SectionCard title="Atajos" subtitle="Entradas rápidas a los dos flujos operativos del técnico.">
        <View style={styles.stack}>
          <PressableCard
            eyebrow="Requests"
            title="Abrir cola de requests"
            subtitle="Ver disponibles, mis asignados y tomar un trabajo."
            onPress={() => pushAppRoute(appRoutes.employeeRequests)}
          />
          <PressableCard
            eyebrow="Emergencias"
            title="Abrir emergency dispatch"
            subtitle="Ver pendientes, aceptadas y compartir ubicación."
            onPress={() => pushAppRoute(appRoutes.employeeEmergencyNew)}
          />
          {bootstrap.featureFlags.builderMobile ? (
            <PressableCard
              eyebrow="Builder"
              title="Abrir estimator"
              subtitle="Consultar y calcular trabajos desde la app."
              onPress={() => pushAppRoute(appRoutes.builderHome)}
            />
          ) : null}
        </View>
      </SectionCard>

      <SectionCard title="Tus requests recientes" subtitle="Los últimos trabajos asignados a tu cuenta.">
        {myRequestsQuery.isLoading ? <Text style={styles.muted}>Cargando tus requests...</Text> : null}
        {myRequestsQuery.error ? (
          <Text style={styles.error}>
            {myRequestsQuery.error instanceof Error ? myRequestsQuery.error.message : 'No se pudo cargar la actividad.'}
          </Text>
        ) : null}
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
        {!myRequestsQuery.isLoading && !myRequestsQuery.error && !recentRequests.length ? (
          <EmptyState
            icon="📋"
            title="Sin requests recientes"
            subtitle="Los trabajos asignados a tu cuenta aparecerán aquí."
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Emergencias asignadas" subtitle="Las emergencias activas que ya están en tu cancha.">
        {emergenciesQuery.isLoading ? <Text style={styles.muted}>Cargando emergencias...</Text> : null}
        {emergenciesQuery.error ? (
          <Text style={styles.error}>
            {emergenciesQuery.error instanceof Error ? emergenciesQuery.error.message : 'No se pudo cargar la actividad.'}
          </Text>
        ) : null}
        {assignedEmergencies.length ? (
          <View style={styles.stack}>
            {assignedEmergencies.map((call) => (
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
        {!emergenciesQuery.isLoading && !emergenciesQuery.error && !assignedEmergencies.length ? (
          <EmptyState
            icon="🚨"
            title="Sin emergencias asignadas"
            subtitle="No tienes emergencias activas en este momento."
          />
        ) : null}
      </SectionCard>

      {homeQuery.error instanceof Error ? <Text style={styles.error}>{homeQuery.error.message}</Text> : null}
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
      title={request.address || 'Solicitud sin dirección'}
      subtitle={request.description || 'Sin descripción'}
      meta={formatDateTime(request.updatedAt || request.createdAt, locale, timezone)}
      onPress={onPress}
    >
      <StatusBadge status={request.status} type="request" />
      <Text style={styles.metaLine}>{request.category || 'General'}</Text>
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
      title={call.location || 'Emergencia sin ubicación'}
      subtitle={call.issue || 'Sin detalle'}
      meta={formatDateTime(call.updatedAt || call.createdAt, locale, timezone)}
      onPress={onPress}
    >
      <StatusBadge status={call.status} type="emergency" />
      <Text style={styles.metaLine}>{call.priority || 'urgent'}</Text>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radii.hero,
    backgroundColor: colors.navy,
    padding: spacing.xxl,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.accent,
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 30,
    fontWeight: '800',
    color: colors.textOnDark,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSubtleOnDark,
  },
  company: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: radii.xxl,
    backgroundColor: colors.cardBg,
    padding: 18,
  },
  statIcon: {
    fontSize: 22,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.navy,
  },
  statLabel: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textSecondary,
  },
  stack: {
    gap: spacing.md,
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
  metaLine: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
