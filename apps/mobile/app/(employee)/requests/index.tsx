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
import { fetchAvailableRequests, fetchEmployeeRequests, withCurrentToken } from '@/src/lib/api';
import { formatDateTime } from '@/src/lib/formatters';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, spacing } from '@/src/theme';
import type { MarketplaceRequest, MobileCompanyConfig } from '@/src/types/api';

export default function EmployeeRequestsScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const companyConfig = bootstrap?.companyConfig;
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'available' | 'mine'>('all');

  const availableQuery = useQuery({
    queryKey: ['employee-available-requests'],
    queryFn: () => withCurrentToken(fetchAvailableRequests),
  });

  const myRequestsQuery = useQuery({
    queryKey: ['employee-my-requests'],
    queryFn: () => withCurrentToken(fetchEmployeeRequests),
  });

  if (!companyConfig) {
    return <LoadingScreen variant="skeleton" />;
  }

  const onRefresh = () => {
    void Promise.all([availableQuery.refetch(), myRequestsQuery.refetch()]);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredAvailable = (availableQuery.data ?? []).filter((request) => {
    if (scopeFilter === 'mine') {
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

  const filteredMine = (myRequestsQuery.data ?? []).filter((request) => {
    if (scopeFilter === 'available') {
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={availableQuery.isRefetching || myRequestsQuery.isRefetching}
          onRefresh={onRefresh}
        />
      }
    >
      <SectionCard
        title="Requests"
        subtitle="Cola operativa real para claim y seguimiento. El detalle ya usa backend y deja listo el siguiente paso para chat, GPS y proof."
      >
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar por direccion, descripcion o categoria"
        />
        <FilterChips
          value={scopeFilter}
          onChange={setScopeFilter}
          options={[
            { label: 'Todo', value: 'all' },
            { label: 'Disponibles', value: 'available' },
            { label: 'Mios', value: 'mine' },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Disponibles"
        subtitle="Solicitudes abiertas que puedes tomar ahora."
      >
        {availableQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}
        {availableQuery.error ? (
          <Text style={styles.error}>
            {availableQuery.error instanceof Error ? availableQuery.error.message : 'No se pudo cargar la cola disponible.'}
          </Text>
        ) : null}
        {filteredAvailable.length ? (
          <View style={styles.stack}>
            {filteredAvailable.map((request) => (
              <RequestCard
                key={request.id}
                companyConfig={companyConfig}
                request={request}
                onPress={() => pushAppRoute(appRoutes.employeeRequestDetail(request.id))}
              />
            ))}
          </View>
        ) : null}
        {!availableQuery.isLoading && !availableQuery.error && !filteredAvailable.length ? (
          <EmptyState
            icon="📭"
            title="Sin requests disponibles"
            subtitle="No hay solicitudes abiertas en este momento."
          />
        ) : null}
      </SectionCard>

      <SectionCard
        title="Mis requests"
        subtitle="Solicitudes que ya estan asignadas a tu cuenta."
      >
        {myRequestsQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}
        {myRequestsQuery.error ? (
          <Text style={styles.error}>
            {myRequestsQuery.error instanceof Error ? myRequestsQuery.error.message : 'No se pudo cargar tu cola.'}
          </Text>
        ) : null}
        {filteredMine.length ? (
          <View style={styles.stack}>
            {filteredMine.map((request) => (
              <RequestCard
                key={request.id}
                companyConfig={companyConfig}
                request={request}
                onPress={() => pushAppRoute(appRoutes.employeeRequestDetail(request.id))}
              />
            ))}
          </View>
        ) : null}
        {!myRequestsQuery.isLoading && !myRequestsQuery.error && !filteredMine.length ? (
          <EmptyState
            icon="📋"
            title="Sin requests asignados"
            subtitle="Los trabajos asignados a tu cuenta aparecerán aquí."
          />
        ) : null}
      </SectionCard>
    </ScrollView>
  );
}

function RequestCard(props: {
  request: MarketplaceRequest;
  companyConfig: MobileCompanyConfig;
  onPress: () => void;
}) {
  const { request, companyConfig, onPress } = props;

  return (
    <PressableCard
      title={request.address || 'Solicitud sin direccion'}
      subtitle={request.description || 'Sin descripcion'}
      meta={formatDateTime(request.createdAt, companyConfig.locale, companyConfig.timezone)}
      onPress={onPress}
    >
      <StatusBadge status={request.status} type="request" />
      <Text style={styles.metaLine}>
        {request.category || 'General'} · {request.employeeName || 'Sin tecnico asignado'}
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
