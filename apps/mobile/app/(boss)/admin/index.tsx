import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { EmptyState } from '@/src/components/EmptyState';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { PressableCard } from '@/src/components/PressableCard';
import { SectionCard } from '@/src/components/SectionCard';
import {
  approveBossEmployeeRequest,
  approveBossPhotoChangeRequest,
  fetchBossEarnings,
  fetchBossEmployeeRequests,
  fetchBossPhotoChangeRequests,
  rejectBossEmployeeRequest,
  rejectBossPhotoChangeRequest,
  withCurrentToken,
} from '@/src/lib/api';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';
import type { BossEmployeeRequest, BossPhotoChangeRequest } from '@/src/types/api';

export default function BossAdminScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const queryClient = useQueryClient();

  const earningsQuery = useQuery({
    queryKey: ['boss-earnings'],
    queryFn: () => withCurrentToken(fetchBossEarnings),
  });

  const employeeRequestsQuery = useQuery({
    queryKey: ['boss-employee-requests'],
    queryFn: () => withCurrentToken(fetchBossEmployeeRequests),
  });

  const photoChangesQuery = useQuery({
    queryKey: ['boss-photo-change-requests'],
    queryFn: () => withCurrentToken(fetchBossPhotoChangeRequests),
  });

  const approveEmployeeMutation = useMutation({
    mutationFn: (requestId: string) => withCurrentToken((token) => approveBossEmployeeRequest(token, requestId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['boss-employee-requests'] });
    },
  });

  const rejectEmployeeMutation = useMutation({
    mutationFn: (requestId: string) => withCurrentToken((token) => rejectBossEmployeeRequest(token, requestId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['boss-employee-requests'] });
    },
  });

  const approvePhotoMutation = useMutation({
    mutationFn: (requestId: string) => withCurrentToken((token) => approveBossPhotoChangeRequest(token, requestId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['boss-photo-change-requests'] });
    },
  });

  const rejectPhotoMutation = useMutation({
    mutationFn: (requestId: string) => withCurrentToken((token) => rejectBossPhotoChangeRequest(token, requestId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['boss-photo-change-requests'] });
    },
  });

  const actionError = useMemo(() => {
    const candidates = [
      approveEmployeeMutation.error,
      rejectEmployeeMutation.error,
      approvePhotoMutation.error,
      rejectPhotoMutation.error,
    ];
    const firstError = candidates.find((candidate) => candidate instanceof Error);
    return firstError instanceof Error ? firstError.message : null;
  }, [
    approveEmployeeMutation.error,
    rejectEmployeeMutation.error,
    approvePhotoMutation.error,
    rejectPhotoMutation.error,
  ]);

  if (!bootstrap) {
    return <LoadingScreen label="Cargando admin..." />;
  }

  const currency = bootstrap.companyConfig.currency;
  const locale = bootstrap.companyConfig.locale;
  const timezone = bootstrap.companyConfig.timezone;
  const earnings = earningsQuery.data;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={
            earningsQuery.isRefetching
            || employeeRequestsQuery.isRefetching
            || photoChangesQuery.isRefetching
          }
          onRefresh={() => {
            void Promise.all([
              earningsQuery.refetch(),
              employeeRequestsQuery.refetch(),
              photoChangesQuery.refetch(),
            ]);
          }}
        />
      }
    >
      <SectionCard title="Earnings" subtitle="Comision del boss y ultimos ingresos aprobados.">
        {earningsQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}
        {earningsQuery.error instanceof Error ? <Text style={styles.error}>{earningsQuery.error.message}</Text> : null}
        {earnings ? (
          <View style={styles.statsGrid}>
            <Metric label="Hoy" value={formatCurrency(earnings.summary.today, currency, locale)} />
            <Metric label="Semana" value={formatCurrency(earnings.summary.thisWeek, currency, locale)} />
            <Metric label="Mes" value={formatCurrency(earnings.summary.thisMonth, currency, locale)} />
            <Metric label="Total" value={formatCurrency(earnings.summary.total, currency, locale)} />
          </View>
        ) : null}
        {earnings?.history?.length ? (
          <View style={styles.stack}>
            {earnings.history.slice(0, 6).map((entry) => (
              <PressableCard
                key={entry.id}
                eyebrow={`Comision ${(earnings.commissionRate * 100).toFixed(0)}%`}
                title={entry.address || entry.description || 'Ingreso'}
                subtitle={entry.employeeName || entry.employeeEmail || 'Sin tecnico'}
                meta={formatDateTime(entry.createdAt, locale, timezone)}
              >
                <Text style={styles.metaLine}>
                  {formatCurrency(entry.commission ?? 0, currency, locale)} de {formatCurrency(entry.finalAmount ?? 0, currency, locale)}
                </Text>
              </PressableCard>
            ))}
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Solicitudes de empleado" subtitle="Aprobacion de nuevos empleados desde móvil.">
        {employeeRequestsQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}
        {employeeRequestsQuery.error instanceof Error ? <Text style={styles.error}>{employeeRequestsQuery.error.message}</Text> : null}
        {employeeRequestsQuery.data?.length ? (
          <View style={styles.stack}>
            {employeeRequestsQuery.data.map((request) => (
              <EmployeeRequestCard
                key={request.id}
                request={request}
                locale={locale}
                timezone={timezone}
                busy={
                  (approveEmployeeMutation.isPending && approveEmployeeMutation.variables === request.id)
                  || (rejectEmployeeMutation.isPending && rejectEmployeeMutation.variables === request.id)
                }
                onApprove={() => approveEmployeeMutation.mutate(request.id)}
                onReject={() => rejectEmployeeMutation.mutate(request.id)}
              />
            ))}
          </View>
        ) : null}
        {!employeeRequestsQuery.isLoading && !employeeRequestsQuery.error && !employeeRequestsQuery.data?.length ? (
          <EmptyState icon="🧑" title="Sin solicitudes" subtitle="No hay solicitudes de empleado pendientes." />
        ) : null}
      </SectionCard>

      <SectionCard title="Cambios de foto" subtitle="Aprobacion de cambios de foto de perfil para tecnicos.">
        {photoChangesQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}
        {photoChangesQuery.error instanceof Error ? <Text style={styles.error}>{photoChangesQuery.error.message}</Text> : null}
        {photoChangesQuery.data?.length ? (
          <View style={styles.stack}>
            {photoChangesQuery.data.map((request) => (
              <PhotoChangeCard
                key={request.id}
                request={request}
                locale={locale}
                timezone={timezone}
                busy={
                  (approvePhotoMutation.isPending && approvePhotoMutation.variables === request.id)
                  || (rejectPhotoMutation.isPending && rejectPhotoMutation.variables === request.id)
                }
                onApprove={() => approvePhotoMutation.mutate(request.id)}
                onReject={() => rejectPhotoMutation.mutate(request.id)}
              />
            ))}
          </View>
        ) : null}
        {!photoChangesQuery.isLoading && !photoChangesQuery.error && !photoChangesQuery.data?.length ? (
          <EmptyState icon="🖼️" title="Sin cambios de foto" subtitle="No hay cambios de foto pendientes." />
        ) : null}
      </SectionCard>

      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
    </ScrollView>
  );
}

function Metric(props: { label: string; value: string }) {
  const { label, value } = props;

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function EmployeeRequestCard(props: {
  request: BossEmployeeRequest;
  locale: string;
  timezone: string;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { request, locale, timezone, busy, onApprove, onReject } = props;

  return (
    <PressableCard
      eyebrow={String(request.status || 'pending').toUpperCase()}
      title={request.displayName || request.name || request.email || 'Solicitud'}
      subtitle={request.email || request.address || request.phone || 'Sin datos adicionales'}
      meta={formatDateTime(request.createdAt, locale, timezone)}
    >
      <View style={styles.actions}>
        {request.photoUrl ? (
          <AppButton tone="secondary" disabled={busy} onPress={() => void Linking.openURL(request.photoUrl ?? '')}>
            Ver selfie
          </AppButton>
        ) : null}
        <AppButton loading={busy} disabled={busy} onPress={onApprove}>
          Aprobar
        </AppButton>
        <AppButton tone="danger" loading={busy} disabled={busy} onPress={onReject}>
          Rechazar
        </AppButton>
      </View>
    </PressableCard>
  );
}

function PhotoChangeCard(props: {
  request: BossPhotoChangeRequest;
  locale: string;
  timezone: string;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { request, locale, timezone, busy, onApprove, onReject } = props;

  return (
    <PressableCard
      eyebrow={String(request.status || 'pending').toUpperCase()}
      title={request.displayName || request.email || 'Cambio de foto'}
      subtitle={request.email || 'Sin email'}
      meta={formatDateTime(request.requestedAt || request.createdAt, locale, timezone)}
    >
      <View style={styles.actions}>
        {request.currentPhotoUrl ? (
          <AppButton tone="secondary" disabled={busy} onPress={() => void Linking.openURL(request.currentPhotoUrl ?? '')}>
            Foto actual
          </AppButton>
        ) : null}
        <AppButton loading={busy} disabled={busy} onPress={onApprove}>
          Aprobar
        </AppButton>
        <AppButton tone="danger" loading={busy} disabled={busy} onPress={onReject}>
          Rechazar
        </AppButton>
      </View>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    minWidth: 140,
    flexGrow: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    padding: 14,
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
  },
  stack: {
    gap: spacing.md,
  },
  actions: {
    gap: 10,
  },
  metaLine: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
});
