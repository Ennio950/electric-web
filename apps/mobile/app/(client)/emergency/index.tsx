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
import { loadClientEmergencyCalls } from '@/src/services/apiService';
import { formatCurrency, formatDateTime, formatEmergencyStatus } from '@/src/lib/formatters';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';
import type { MarketplaceEmergencyCall } from '@/src/types/api';

const ACTIVE_STATUSES = new Set([
  'pending',
  'accepted',
  'awaiting_client_close',
  'awaiting_payment_proof',
  'payment_pending_review',
]);

const WAITING_STATUSES = new Set([
  'awaiting_client_close',
]);

export default function ClientEmergencyListScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'active' | 'waiting' | 'scheduled' | 'closed'>('all');

  const emergencyQuery = useQuery({
    queryKey: ['client-emergency-calls'],
    queryFn: loadClientEmergencyCalls,
  });

  if (!bootstrap) {
    return <LoadingScreen label="Cargando emergencias..." />;
  }

  const calls = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return (emergencyQuery.data ?? []).filter((call) => {
      const status = String(call.status || '').trim().toLowerCase();
      const dispatchMode = String(call.dispatchMode || '').trim().toLowerCase();

      if (scopeFilter === 'active' && !ACTIVE_STATUSES.has(status)) {
        return false;
      }

      if (scopeFilter === 'waiting' && !WAITING_STATUSES.has(status)) {
        return false;
      }

      if (scopeFilter === 'scheduled' && dispatchMode !== 'scheduled') {
        return false;
      }

      if (scopeFilter === 'closed' && ACTIVE_STATUSES.has(status)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        call.location,
        call.issue,
        call.clientName,
        call.assignedEmployeeName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [emergencyQuery.data, scopeFilter, searchQuery]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={emergencyQuery.isRefetching} onRefresh={() => void emergencyQuery.refetch()} />}
    >
      <SectionCard
        title="Emergencias y programados"
        subtitle="Aqui ves tus servicios urgentes o programados, con seguimiento y cierre."
      >
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar por ubicacion, detalle o tecnico"
        />
        <FilterChips
          value={scopeFilter}
          onChange={setScopeFilter}
          options={[
            { label: 'Todo', value: 'all' },
            { label: 'Activas', value: 'active' },
            { label: 'Accion mia', value: 'waiting' },
            { label: 'Programadas', value: 'scheduled' },
            { label: 'Cerradas', value: 'closed' },
          ]}
        />
        <AppButton onPress={() => pushAppRoute(appRoutes.clientEmergencyNew)}>Nueva emergencia</AppButton>
      </SectionCard>

      <SectionCard title="Historial">
        {emergencyQuery.isLoading ? <Text style={styles.muted}>Cargando tus emergencias...</Text> : null}
        {emergencyQuery.error ? (
          <QueryErrorBanner error={emergencyQuery.error} fallbackMessage="No se pudo cargar el historial." onRetry={() => void emergencyQuery.refetch()} />
        ) : null}
        {calls.length ? (
          <View style={styles.stack}>
            {calls.map((call) => (
              <EmergencyCard
                key={call.id}
                call={call}
                locale={bootstrap.companyConfig.locale}
                timezone={bootstrap.companyConfig.timezone}
                currency={bootstrap.companyConfig.currency}
                onPress={() => pushAppRoute(appRoutes.clientEmergencyDetail(call.id))}
              />
            ))}
          </View>
        ) : null}
        {!emergencyQuery.isLoading && !emergencyQuery.error && !calls.length ? (
          <Text style={styles.muted}>No hay emergencias para este filtro.</Text>
        ) : null}
      </SectionCard>
    </ScrollView>
  );
}

function EmergencyCard(props: {
  call: MarketplaceEmergencyCall;
  locale: string;
  timezone: string;
  currency: string;
  onPress: () => void;
}) {
  const { call, locale, timezone, currency, onPress } = props;

  return (
    <PressableCard
      eyebrow={formatEmergencyStatus(call.status)}
      title={call.location || 'Emergencia sin ubicacion'}
      subtitle={call.issue || 'Sin detalle'}
      meta={formatDateTime(call.updatedAt || call.createdAt, locale, timezone)}
      onPress={onPress}
    >
      <Text style={styles.metaLine}>
        {(call.dispatchMode || 'emergency').toUpperCase()} · {formatCurrency(call.finalAmount ?? call.quotedAmount, currency, locale)}
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
  metaLine: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
