import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/EmptyState';
import { FilterChips } from '@/src/components/FilterChips';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { PressableCard } from '@/src/components/PressableCard';
import { SearchField } from '@/src/components/SearchField';
import { SectionCard } from '@/src/components/SectionCard';
import { StatusBadge } from '@/src/components/StatusBadge';
import { useEmployeeEmergencyCallsQuery } from '@/src/hooks/useMobileDataQueries';
import { formatDateTime } from '@/src/lib/formatters';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, spacing } from '@/src/theme';
import type { MarketplaceEmergencyCall } from '@/src/types/api';

export default function EmployeeEmergencyQueueScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const companyConfig = bootstrap?.companyConfig;
  const currentUserId = bootstrap?.user.uid;
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'pending' | 'mine'>('all');

  const emergenciesQuery = useEmployeeEmergencyCallsQuery();

  if (!companyConfig || !currentUserId) {
    return <LoadingScreen variant="skeleton" />;
  }

  const calls = emergenciesQuery.data ?? [];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  
  const pendingCalls = calls.filter((call) => {
    if (scopeFilter === 'mine') {
      return false;
    }
    if (call.status !== 'pending') {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      call.location,
      call.issue,
      call.priority,
      call.clientName,
      call.clientEmail,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  const assignedCalls = calls.filter((call) => {
    if (scopeFilter === 'pending') {
      return false;
    }
    if (call.assignedEmployeeId !== currentUserId) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      call.location,
      call.issue,
      call.priority,
      call.clientName,
      call.clientEmail,
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
      refreshControl={<RefreshControl refreshing={emergenciesQuery.isRefetching} onRefresh={() => void emergenciesQuery.refetch()} />}
    >
      <SectionCard
        title="Emergency Dispatch"
        subtitle="La creacion sigue del lado client por contrato actual. Desde staff ya puedes ver la cola real y abrir el detalle operativo."
      >
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar por ubicacion, cliente o problema"
        />
        <FilterChips
          value={scopeFilter}
          onChange={setScopeFilter}
          options={[
            { label: 'Todo', value: 'all' },
            { label: 'Pendientes', value: 'pending' },
            { label: 'Mias', value: 'mine' },
          ]}
        />
      </SectionCard>

      <SectionCard title="Pendientes" subtitle="Emergencias abiertas disponibles para aceptar.">
        {emergenciesQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}
        {emergenciesQuery.error ? (
          <Text style={styles.error}>
            {emergenciesQuery.error instanceof Error ? emergenciesQuery.error.message : 'No se pudo cargar la cola.'}
          </Text>
        ) : null}
        {pendingCalls.length ? (
          <View style={styles.stack}>
            {pendingCalls.map((call) => (
              <EmergencyCard
                key={call.id}
                call={call}
                locale={companyConfig.locale}
                timezone={companyConfig.timezone}
                onPress={() => pushAppRoute(appRoutes.employeeEmergencyDetail(call.id))}
              />
            ))}
          </View>
        ) : null}
        {!emergenciesQuery.isLoading && !emergenciesQuery.error && !pendingCalls.length ? (
          <EmptyState
            icon="✅"
            title="Sin emergencias pendientes"
            subtitle="No hay emergencias abiertas por ahora."
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Asignadas a mi" subtitle="Emergencias ya tomadas por tu usuario.">
        {assignedCalls.length ? (
          <View style={styles.stack}>
            {assignedCalls.map((call) => (
              <EmergencyCard
                key={call.id}
                call={call}
                locale={companyConfig.locale}
                timezone={companyConfig.timezone}
                onPress={() => pushAppRoute(appRoutes.employeeEmergencyDetail(call.id))}
              />
            ))}
          </View>
        ) : null}
        {!emergenciesQuery.isLoading && !emergenciesQuery.error && !assignedCalls.length ? (
          <EmptyState
            icon="🚨"
            title="Sin emergencias asignadas"
            subtitle="Todavía no tienes emergencias asignadas."
          />
        ) : null}
      </SectionCard>
    </ScrollView>
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
      title={call.location || 'Sin ubicacion'}
      subtitle={call.issue || 'Sin detalle'}
      meta={formatDateTime(call.createdAt, locale, timezone)}
      onPress={onPress}
    >
      <StatusBadge status={call.status} type="emergency" />
      <Text style={styles.metaLine}>
        {call.priority || 'urgent'} · {call.assignedEmployeeName || 'Sin tecnico asignado'}
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
