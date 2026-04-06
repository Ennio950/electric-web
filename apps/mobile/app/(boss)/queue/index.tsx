import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/EmptyState';
import { FilterChips } from '@/src/components/FilterChips';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { PressableCard } from '@/src/components/PressableCard';
import { SearchField } from '@/src/components/SearchField';
import { SectionCard } from '@/src/components/SectionCard';
import { StatusBadge } from '@/src/components/StatusBadge';
import { fetchBossRequests, fetchEmergencyCalls, withCurrentToken } from '@/src/lib/api';
import { formatDateTime } from '@/src/lib/formatters';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, spacing } from '@/src/theme';
import type { MarketplaceEmergencyCall, MarketplaceRequest } from '@/src/types/api';

export default function BossQueueScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const companyConfig = bootstrap?.companyConfig;
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'request' | 'emergency'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'payment' | 'done'>('all');

  const requestsQuery = useQuery({
    queryKey: ['boss-requests'],
    queryFn: () => withCurrentToken(fetchBossRequests),
  });

  const emergenciesQuery = useQuery({
    queryKey: ['boss-emergency-calls'],
    queryFn: () => withCurrentToken((token) => fetchEmergencyCalls(token, { mode: 'all' })),
  });

  if (!companyConfig) {
    return <LoadingScreen variant="skeleton" />;
  }

  const onRefresh = () => {
    void Promise.all([requestsQuery.refetch(), emergenciesQuery.refetch()]);
  };

  const REQUEST_STATUS_GROUPS: Record<typeof statusFilter, string[] | null> = {
    all: null,
    open: ['EN_ESPERA', 'ASIGNADO'],
    in_progress: ['NEGOCIANDO', 'EN_PROCESO'],
    payment: ['ESPERANDO_CIERRE_CLIENTE', 'ESPERANDO_COMPROBANTE_PAGO', 'PAGO_PENDIENTE_REVISION'],
    done: ['COMPLETADO'],
  };

  const EMERGENCY_STATUS_GROUPS: Record<typeof statusFilter, string[] | null> = {
    all: null,
    open: ['pending', 'scheduled'],
    in_progress: ['accepted', 'en_route', 'on_site'],
    payment: ['resolved', 'payment_review'],
    done: ['completed'],
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const allowedRequestStatuses = REQUEST_STATUS_GROUPS[statusFilter];
  const allowedEmergencyStatuses = EMERGENCY_STATUS_GROUPS[statusFilter];

  const filteredRequests = (requestsQuery.data ?? []).filter((request) => {
    if (scopeFilter === 'emergency') return false;
    if (allowedRequestStatuses && !allowedRequestStatuses.includes(request.status)) return false;
    if (!normalizedQuery) return true;

    const haystack = [
      request.address,
      request.description,
      request.employeeName,
      request.employeeEmail,
      request.clientNickname,
      request.clientEmail,
      request.category,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  const filteredEmergencies = (emergenciesQuery.data ?? []).filter((call) => {
    if (scopeFilter === 'request') return false;
    if (allowedEmergencyStatuses && !allowedEmergencyStatuses.includes(call.status)) return false;
    if (!normalizedQuery) return true;

    const haystack = [
      call.location,
      call.issue,
      call.assignedEmployeeName,
      call.assignedEmployeeEmail,
      call.clientName,
      call.clientEmail,
      call.priority,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={requestsQuery.isRefetching || emergenciesQuery.isRefetching}
          onRefresh={onRefresh}
        />
      }
    >
      <SectionCard
        title="Queue"
        subtitle="Vista operativa de boss para solicitudes y emergencias, con asignacion inicial de tecnico."
      >
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar por cliente, tecnico, direccion o descripcion"
        />
        <FilterChips
          value={scopeFilter}
          onChange={setScopeFilter}
          options={[
            { label: 'Todo', value: 'all' },
            { label: 'Requests', value: 'request' },
            { label: 'Emergencias', value: 'emergency' },
          ]}
        />
        <FilterChips
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: 'Todos', value: 'all' },
            { label: 'Pendientes', value: 'open' },
            { label: 'En progreso', value: 'in_progress' },
            { label: 'Pagos', value: 'payment' },
            { label: 'Completados', value: 'done' },
          ]}
        />
      </SectionCard>

      <SectionCard title="Solicitudes" subtitle="Cola general de requests.">
        {requestsQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}
        {requestsQuery.error ? (
          <Text style={styles.error}>
            {requestsQuery.error instanceof Error ? requestsQuery.error.message : 'No se pudo cargar la cola de requests.'}
          </Text>
        ) : null}
        {filteredRequests.length ? (
          <View style={styles.stack}>
            {filteredRequests.map((request) => (
              <RequestCard
                key={request.id}
                locale={companyConfig.locale}
                timezone={companyConfig.timezone}
                request={request}
                onPress={() => pushAppRoute(appRoutes.bossQueueDetail(request.id, 'request'))}
              />
            ))}
          </View>
        ) : null}
        {!requestsQuery.isLoading && !requestsQuery.error && !filteredRequests.length ? (
          <EmptyState
            icon="📋"
            title="Sin requests"
            subtitle="No hay solicitudes para revisar."
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Emergencias" subtitle="Incluye pendientes, programadas y en curso.">
        {emergenciesQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}
        {emergenciesQuery.error ? (
          <Text style={styles.error}>
            {emergenciesQuery.error instanceof Error ? emergenciesQuery.error.message : 'No se pudo cargar la cola de emergencias.'}
          </Text>
        ) : null}
        {filteredEmergencies.length ? (
          <View style={styles.stack}>
            {filteredEmergencies.map((call) => (
              <EmergencyCard
                key={call.id}
                locale={companyConfig.locale}
                timezone={companyConfig.timezone}
                call={call}
                onPress={() => pushAppRoute(appRoutes.bossQueueDetail(call.id, 'emergency'))}
              />
            ))}
          </View>
        ) : null}
        {!emergenciesQuery.isLoading && !emergenciesQuery.error && !filteredEmergencies.length ? (
          <EmptyState
            icon="🚨"
            title="Sin emergencias"
            subtitle="No hay emergencias activas."
          />
        ) : null}
      </SectionCard>
    </ScrollView>
  );
}

function RequestCard(props: {
  request: MarketplaceRequest;
  locale: string;
  timezone: string;
  onPress: () => void;
}) {
  const { request, locale, timezone, onPress } = props;

  return (
    <PressableCard
      title={request.address || 'Solicitud sin direccion'}
      subtitle={request.description || 'Sin descripcion'}
      meta={formatDateTime(request.createdAt, locale, timezone)}
      onPress={onPress}
    >
      <StatusBadge status={request.status} type="request" />
      <Text style={styles.metaLine}>
        {request.employeeName || 'Sin tecnico'} · {request.clientNickname || request.clientEmail || 'Sin cliente'}
      </Text>
    </PressableCard>
  );
}

function EmergencyCard(props: {
  call: MarketplaceEmergencyCall;
  locale: string;
  timezone: string;
  onPress: () => void;
}) {
  const { call, locale, timezone, onPress } = props;

  return (
    <PressableCard
      title={call.location || 'Emergencia sin ubicacion'}
      subtitle={call.issue || 'Sin detalle'}
      meta={formatDateTime(call.createdAt, locale, timezone)}
      onPress={onPress}
    >
      <StatusBadge status={call.status} type="emergency" />
      <Text style={styles.metaLine}>
        {call.assignedEmployeeName || 'Sin tecnico'} · {call.clientName || call.clientEmail || 'Sin cliente'}
      </Text>
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
  stack: {
    gap: spacing.md,
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
