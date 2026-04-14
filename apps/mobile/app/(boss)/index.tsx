import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/EmptyState';
import { PressableCard } from '@/src/components/PressableCard';
import { QueryErrorBanner } from '@/src/components/QueryErrorBanner';
import { SectionCard } from '@/src/components/SectionCard';
import { SignOutButton } from '@/src/components/SignOutButton';
import { StatusBadge } from '@/src/components/StatusBadge';
import {
  fetchBossRequests,
  fetchBossReviewQueue,
  fetchEmergencyCalls,
  withCurrentToken,
} from '@/src/lib/api';
import {
  formatCurrency,
  formatDateTime,
  formatQueueSourceType,
} from '@/src/lib/formatters';
import { useMobileHomeQuery } from '@/src/hooks/useMobileHomeQuery';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';
import type { BossReviewQueueItem, MarketplaceEmergencyCall, MarketplaceRequest } from '@/src/types/api';

export default function BossHomeScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const homeQuery = useMobileHomeQuery();
  const reviewQueueQuery = useQuery({
    queryKey: ['boss-home-review-queue'],
    queryFn: () => withCurrentToken(fetchBossReviewQueue),
  });
  const requestsQuery = useQuery({
    queryKey: ['boss-home-requests'],
    queryFn: () => withCurrentToken(fetchBossRequests),
  });
  const emergenciesQuery = useQuery({
    queryKey: ['boss-home-emergencies'],
    queryFn: () => withCurrentToken((token) => fetchEmergencyCalls(token, { mode: 'all' })),
  });

  if (!bootstrap) {
    return null;
  }

  const summary = homeQuery.data?.role === 'boss' ? homeQuery.data.summary : null;
  const priorityReviews = (reviewQueueQuery.data ?? []).slice(0, 3);
  const recentRequests = (requestsQuery.data ?? []).slice(0, 3);
  const activeEmergencies = (emergenciesQuery.data ?? [])
    .filter((call) => call.status !== 'completed')
    .slice(0, 3);

  const onRefresh = () => {
    void Promise.all([
      homeQuery.refetch(),
      reviewQueueQuery.refetch(),
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
            || reviewQueueQuery.isRefetching
            || requestsQuery.isRefetching
            || emergenciesQuery.isRefetching
          }
          onRefresh={onRefresh}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>BOSS</Text>
        <Text style={styles.title}>Centro de control</Text>
        <Text style={styles.subtitle}>Prioridades del día, cola de revisión y acceso rápido a operación.</Text>
        <Text style={styles.company}>{bootstrap.companyConfig.companyName}</Text>
      </View>

      <View style={styles.grid}>
        <StatCard icon="📋" label="Requests pendientes" value={summary?.pendingRequests ?? 0} />
        <StatCard icon="🚨" label="Emergencias activas" value={summary?.activeEmergencies ?? 0} />
        <StatCard icon="💰" label="Pagos pendientes" value={summary?.pendingPayments ?? 0} />
        <StatCard icon="📊" label="Review queue" value={summary?.reviewQueue ?? 0} />
      </View>

      <SectionCard title="Atajos" subtitle="Accesos directos a la cola operativa del jefe.">
        <View style={styles.stack}>
          <PressableCard
            eyebrow="Queue"
            title="Abrir queue"
            subtitle="Requests y emergencias con detalle operativo."
            onPress={() => pushAppRoute(appRoutes.bossQueue)}
          />
          <PressableCard
            eyebrow="Payments"
            title="Abrir payments"
            subtitle="Revisar comprobantes, aprobar y rechazar."
            onPress={() => pushAppRoute(appRoutes.bossPayments)}
          />
          <PressableCard
            eyebrow="Admin"
            title="Abrir admin"
            subtitle="Aprobar empleados, revisar cambios de foto y ver earnings."
            onPress={() => pushAppRoute(appRoutes.bossAdmin)}
          />
          <PressableCard
            eyebrow="Settings"
            title="Abrir settings"
            subtitle="Configurar datos de empresa y probar canales de alertas."
            onPress={() => pushAppRoute(appRoutes.bossSettings)}
          />
          {bootstrap.featureFlags.builderMobile ? (
            <PressableCard
              eyebrow="Builder"
              title="Abrir estimator"
              subtitle="Jobs, materiales y recetas del builder nativo."
              onPress={() => pushAppRoute(appRoutes.builderHome)}
            />
          ) : null}
        </View>
      </SectionCard>

      <SectionCard title="Prioridad ahora" subtitle="Los próximos comprobantes que no deberían esperar.">
        {reviewQueueQuery.isLoading ? <Text style={styles.muted}>Cargando review queue...</Text> : null}
        {reviewQueueQuery.error ? (
          <QueryErrorBanner error={reviewQueueQuery.error} fallbackMessage="No se pudo cargar la cola." onRetry={() => void reviewQueueQuery.refetch()} />
        ) : null}
        {priorityReviews.length ? (
          <View style={styles.stack}>
            {priorityReviews.map((row) => (
              <ReviewPreviewCard
                key={row.queueId}
                row={row}
                locale={bootstrap.companyConfig.locale}
                timezone={bootstrap.companyConfig.timezone}
                currency={bootstrap.companyConfig.currency}
                onPress={() => pushAppRoute(appRoutes.bossPaymentDetail(row.recordId, row.sourceType))}
              />
            ))}
          </View>
        ) : null}
        {!reviewQueueQuery.isLoading && !reviewQueueQuery.error && !priorityReviews.length ? (
          <EmptyState
            icon="💳"
            title="Sin pagos pendientes"
            subtitle="No hay comprobantes por revisar ahora."
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Requests recientes" subtitle="Los últimos movimientos en solicitudes.">
        {requestsQuery.isLoading ? <Text style={styles.muted}>Cargando requests...</Text> : null}
        {requestsQuery.error ? (
          <QueryErrorBanner error={requestsQuery.error} fallbackMessage="No se pudo cargar la actividad." onRetry={() => void requestsQuery.refetch()} />
        ) : null}
        {recentRequests.length ? (
          <View style={styles.stack}>
            {recentRequests.map((request) => (
              <RequestPreviewCard
                key={request.id}
                request={request}
                locale={bootstrap.companyConfig.locale}
                timezone={bootstrap.companyConfig.timezone}
                onPress={() => pushAppRoute(appRoutes.bossQueueDetail(request.id, 'request'))}
              />
            ))}
          </View>
        ) : null}
        {!requestsQuery.isLoading && !requestsQuery.error && !recentRequests.length ? (
          <EmptyState
            icon="📋"
            title="Sin requests recientes"
            subtitle="Los movimientos en solicitudes aparecerán aquí."
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Emergencias en curso" subtitle="Lo más reciente para seguimiento rápido desde móvil.">
        {emergenciesQuery.isLoading ? <Text style={styles.muted}>Cargando emergencias...</Text> : null}
        {emergenciesQuery.error ? (
          <QueryErrorBanner error={emergenciesQuery.error} fallbackMessage="No se pudo cargar la actividad." onRetry={() => void emergenciesQuery.refetch()} />
        ) : null}
        {activeEmergencies.length ? (
          <View style={styles.stack}>
            {activeEmergencies.map((call) => (
              <EmergencyPreviewCard
                key={call.id}
                call={call}
                locale={bootstrap.companyConfig.locale}
                timezone={bootstrap.companyConfig.timezone}
                onPress={() => pushAppRoute(appRoutes.bossQueueDetail(call.id, 'emergency'))}
              />
            ))}
          </View>
        ) : null}
        {!emergenciesQuery.isLoading && !emergenciesQuery.error && !activeEmergencies.length ? (
          <EmptyState
            icon="🚨"
            title="Sin emergencias activas"
            subtitle="No hay emergencias en curso ahora mismo."
          />
        ) : null}
      </SectionCard>

      {homeQuery.error ? <QueryErrorBanner error={homeQuery.error} onRetry={() => void homeQuery.refetch()} /> : null}
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

function ReviewPreviewCard(props: {
  row: BossReviewQueueItem;
  locale: string;
  timezone: string;
  currency: string;
  onPress: () => void;
}) {
  const { row, locale, timezone, currency, onPress } = props;

  return (
    <PressableCard
      eyebrow={formatQueueSourceType(row.sourceType)}
      title={row.address || row.description || 'Revisión pendiente'}
      subtitle={row.employeeName || row.employeeEmail || 'Sin técnico'}
      meta={formatDateTime(row.paymentProofAt, locale, timezone)}
      onPress={onPress}
    >
      <StatusBadge status={row.status ?? 'payment_review'} type="request" />
      <Text style={styles.amount}>{formatCurrency(row.amount, currency, locale)}</Text>
    </PressableCard>
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
      <Text style={styles.metaLine}>{request.employeeName || request.clientNickname || request.clientEmail || 'Sin dato'}</Text>
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
      <Text style={styles.metaLine}>{call.assignedEmployeeName || call.clientName || call.clientEmail || 'Sin dato'}</Text>
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
  amount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
  },
  metaLine: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
