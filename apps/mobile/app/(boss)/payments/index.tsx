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
import { fetchBossReviewQueue, withCurrentToken } from '@/src/lib/api';
import { formatCurrency, formatDateTime, formatQueueSourceType } from '@/src/lib/formatters';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, spacing } from '@/src/theme';
import type { BossReviewQueueItem, MobileCompanyConfig } from '@/src/types/api';

export default function BossPaymentsScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const companyConfig = bootstrap?.companyConfig;
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'request' | 'emergency'>('all');

  const reviewQueueQuery = useQuery({
    queryKey: ['boss-review-queue'],
    queryFn: () => withCurrentToken(fetchBossReviewQueue),
  });

  if (!companyConfig) {
    return <LoadingScreen variant="skeleton" />;
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRows = (reviewQueueQuery.data ?? []).filter((row) => {
    if (sourceFilter !== 'all' && row.sourceType !== sourceFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      row.address,
      row.description,
      row.employeeName,
      row.employeeEmail,
      row.clientName,
      row.clientEmail,
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
      refreshControl={<RefreshControl refreshing={reviewQueueQuery.isRefetching} onRefresh={() => void reviewQueueQuery.refetch()} />}
    >
      <SectionCard
        title="Payments"
        subtitle="Cola unificada de comprobantes de solicitudes y emergencias lista para approve/reject."
      >
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar por cliente, tecnico, direccion o descripcion"
        />
        <FilterChips
          value={sourceFilter}
          onChange={setSourceFilter}
          options={[
            { label: 'Todo', value: 'all' },
            { label: 'Requests', value: 'request' },
            { label: 'Emergencias', value: 'emergency' },
          ]}
        />
      </SectionCard>

      <SectionCard title="Pendientes de revision">
        {reviewQueueQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}
        {reviewQueueQuery.error ? (
          <Text style={styles.error}>
            {reviewQueueQuery.error instanceof Error ? reviewQueueQuery.error.message : 'No se pudo cargar la cola de pagos.'}
          </Text>
        ) : null}
        {filteredRows.length ? (
          <View style={styles.stack}>
            {filteredRows.map((row) => (
              <ReviewCard
                key={row.queueId}
                companyConfig={companyConfig}
                row={row}
                onPress={() => pushAppRoute(appRoutes.bossPaymentDetail(row.recordId, row.sourceType))}
              />
            ))}
          </View>
        ) : null}
        {!reviewQueueQuery.isLoading && !reviewQueueQuery.error && !filteredRows.length ? (
          <EmptyState
            icon="💳"
            title="Sin pagos pendientes"
            subtitle="No hay comprobantes esperando revisión."
          />
        ) : null}
      </SectionCard>
    </ScrollView>
  );
}

function ReviewCard(props: {
  row: BossReviewQueueItem;
  companyConfig: MobileCompanyConfig;
  onPress: () => void;
}) {
  const { row, companyConfig, onPress } = props;

  return (
    <PressableCard
      eyebrow={formatQueueSourceType(row.sourceType)}
      title={row.address || row.description || 'Revision pendiente'}
      subtitle={row.employeeName || row.employeeEmail || 'Sin tecnico'}
      meta={formatDateTime(row.paymentProofAt, companyConfig.locale, companyConfig.timezone)}
      onPress={onPress}
    >
      <StatusBadge status={row.status ?? 'payment_review'} type="request" />
      <Text style={styles.amount}>
        {formatCurrency(row.amount, companyConfig.currency, companyConfig.locale)}
      </Text>
      <Text style={styles.metaLine}>
        {row.clientName || row.clientEmail || 'Sin cliente'}
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
  amount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.navy,
  },
  metaLine: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
