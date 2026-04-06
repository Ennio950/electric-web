import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/EmptyState';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { PressableCard } from '@/src/components/PressableCard';
import { SectionCard } from '@/src/components/SectionCard';
import { fetchBuilderEstimates, withCurrentToken } from '@/src/lib/api';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';

export default function EstimateHistoryScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);

  const query = useQuery({
    queryKey: ['builder-estimates'],
    queryFn: () => withCurrentToken(fetchBuilderEstimates),
  });

  const locale = bootstrap?.companyConfig.locale ?? 'es-GT';
  const timezone = bootstrap?.companyConfig.timezone ?? 'America/Guatemala';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
        />
      }
    >
      <SectionCard
        title="Historial de estimaciones"
        subtitle={query.data ? `${query.data.length} estimaciones guardadas` : 'Cargando...'}
      />

      {query.isLoading ? <LoadingScreen variant="skeleton" /> : null}

      {query.error instanceof Error ? (
        <SectionCard title="Error">
          <Text style={styles.error}>{query.error.message}</Text>
        </SectionCard>
      ) : null}

      {query.data?.length ? (
        <View style={styles.stack}>
          {query.data.map((estimate) => (
            <PressableCard
              key={estimate.id}
              eyebrow={estimate.quoteNumber ?? 'Sin número'}
              title={estimate.jobName || estimate.description || 'Estimación'}
              subtitle={estimate.createdByEmail ?? ''}
              meta={formatDateTime(estimate.createdAt, locale, timezone)}
              onPress={() => {
                // Navigate to estimate PDF download via the preview route
                // (re-uses the same download/share flow from estimate-preview)
                pushAppRoute(appRoutes.builderEstimateDetail(estimate.id));
              }}
            >
              <Text style={styles.amount}>
                {formatCurrency(estimate.grandTotal, estimate.currency, locale)}
              </Text>
              {estimate.requestId ? (
                <Text style={styles.tag}>Vinculada a solicitud</Text>
              ) : null}
            </PressableCard>
          ))}
        </View>
      ) : null}

      {!query.isLoading && !query.error && !query.data?.length ? (
        <EmptyState
          icon="📋"
          title="Sin estimaciones"
          subtitle="Las estimaciones guardadas desde el builder aparecerán aquí."
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  stack: {
    gap: 12,
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10233F',
  },
  tag: {
    fontSize: 12,
    color: '#1A73E8',
    fontWeight: '600',
  },
  error: {
    fontSize: 14,
    color: '#B42318',
  },
});
