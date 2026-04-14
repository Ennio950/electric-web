import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { FilterChips } from '@/src/components/FilterChips';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { PressableCard } from '@/src/components/PressableCard';
import { QueryErrorBanner } from '@/src/components/QueryErrorBanner';
import { SearchField } from '@/src/components/SearchField';
import { SectionCard } from '@/src/components/SectionCard';
import { loadClientRequests } from '@/src/services/apiService';
import { formatCurrency, formatDateTime, formatRequestStatus } from '@/src/lib/formatters';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';
import type { MarketplaceRequest } from '@/src/types/api';

const WAITING_STATUSES = new Set([
  'NEGOCIANDO',
  'ESPERANDO_CIERRE_CLIENTE',
  'ESPERANDO_COMPROBANTE_PAGO',
]);

const ACTIVE_STATUSES = new Set([
  'EN_ESPERA',
  'ASIGNADO',
  'NEGOCIANDO',
  'EN_PROCESO',
  'ESPERANDO_CIERRE_CLIENTE',
  'ESPERANDO_COMPROBANTE_PAGO',
  'PAGO_PENDIENTE_REVISION',
]);

export default function ClientRequestsScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'active' | 'waiting' | 'closed'>('all');

  const requestsQuery = useQuery({
    queryKey: ['client-requests'],
    queryFn: loadClientRequests,
  });

  if (!bootstrap) {
    return <LoadingScreen label="Cargando requests..." />;
  }

  const requests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return (requestsQuery.data ?? []).filter((request) => {
      const status = String(request.status || '').trim().toUpperCase();

      if (scopeFilter === 'active' && !ACTIVE_STATUSES.has(status)) {
        return false;
      }

      if (scopeFilter === 'waiting' && !WAITING_STATUSES.has(status)) {
        return false;
      }

      if (scopeFilter === 'closed' && ACTIVE_STATUSES.has(status)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        request.address,
        request.description,
        request.category,
        request.employeeName,
        request.employeeEmail,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [requestsQuery.data, scopeFilter, searchQuery]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={requestsQuery.isRefetching} onRefresh={() => void requestsQuery.refetch()} />}
    >
      <SectionCard
        title="Mis solicitudes"
        subtitle="Cliente ya puede crear, seguir y cerrar sus propios requests desde nativo."
      >
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar por direccion, descripcion o tecnico"
        />
        <FilterChips
          value={scopeFilter}
          onChange={setScopeFilter}
          options={[
            { label: 'Todo', value: 'all' },
            { label: 'Activas', value: 'active' },
            { label: 'Accion mia', value: 'waiting' },
            { label: 'Cerradas', value: 'closed' },
          ]}
        />
        <AppButton onPress={() => pushAppRoute(appRoutes.clientRequestsNew)}>Nueva solicitud</AppButton>
      </SectionCard>

      <SectionCard title="Historial">
        {requestsQuery.isLoading ? <Text style={styles.muted}>Cargando tus solicitudes...</Text> : null}
        {requestsQuery.error ? (
          <QueryErrorBanner error={requestsQuery.error} fallbackMessage="No se pudo cargar tu historial." onRetry={() => void requestsQuery.refetch()} />
        ) : null}
        {requests.length ? (
          <View style={styles.stack}>
            {requests.map((request) => (
              <ClientRequestCard
                key={request.id}
                request={request}
                locale={bootstrap.companyConfig.locale}
                timezone={bootstrap.companyConfig.timezone}
                currency={bootstrap.companyConfig.currency}
                onPress={() => pushAppRoute(appRoutes.clientRequestDetail(request.id))}
              />
            ))}
          </View>
        ) : null}
        {!requestsQuery.isLoading && !requestsQuery.error && !requests.length ? (
          <Text style={styles.muted}>No hay solicitudes para este filtro.</Text>
        ) : null}
      </SectionCard>
    </ScrollView>
  );
}

function ClientRequestCard(props: {
  request: MarketplaceRequest;
  locale: string;
  timezone: string;
  currency: string;
  onPress: () => void;
}) {
  const { request, locale, timezone, currency, onPress } = props;

  return (
    <PressableCard
      eyebrow={formatRequestStatus(request.status)}
      title={request.address || 'Solicitud sin direccion'}
      subtitle={request.description || 'Sin descripcion'}
      meta={formatDateTime(request.updatedAt || request.createdAt, locale, timezone)}
      onPress={onPress}
    >
      <Text style={styles.metaLine}>
        {request.category || 'General'} · {formatCurrency(request.finalAmount, currency, locale)}
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
