import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/EmptyState';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { PressableCard } from '@/src/components/PressableCard';
import { SectionCard } from '@/src/components/SectionCard';
import { StatusBadge } from '@/src/components/StatusBadge';
import { fetchEmergencyCalls, withCurrentToken } from '@/src/lib/api';
import { formatEmergencyStatus } from '@/src/lib/formatters';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, spacing } from '@/src/theme';
import type { MarketplaceEmergencyCall } from '@/src/types/api';

type DayGroup = {
  dateKey: string;   // YYYY-MM-DD
  label: string;     // 'Hoy', 'Mañana', or formatted date
  calls: MarketplaceEmergencyCall[];
};

function toDateKey(isoOrDate: string | null | undefined): string | null {
  if (!isoOrDate) return null;
  return isoOrDate.slice(0, 10); // YYYY-MM-DD
}

function buildDayLabel(dateKey: string, todayKey: string): string {
  const diff = dateDiffDays(todayKey, dateKey);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  // Format as "Lun 12 May"
  try {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return dateKey;
  }
}

function dateDiffDays(a: string, b: string): number {
  const msA = new Date(a + 'T00:00:00').getTime();
  const msB = new Date(b + 'T00:00:00').getTime();
  return Math.round((msB - msA) / 86_400_000);
}

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function groupByDay(calls: MarketplaceEmergencyCall[]): DayGroup[] {
  const todayKey = getTodayKey();
  const map = new Map<string, MarketplaceEmergencyCall[]>();

  for (const call of calls) {
    const key =
      toDateKey(call.scheduledDate) ??
      toDateKey(call.scheduledFor) ??
      toDateKey(call.createdAt);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(call);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, dayCalls]) => ({
      dateKey,
      label: buildDayLabel(dateKey, todayKey),
      calls: dayCalls.sort((a, b) => {
        const ta = a.scheduledTime ?? '99:99';
        const tb = b.scheduledTime ?? '99:99';
        return ta.localeCompare(tb);
      }),
    }));
}

export default function BossScheduleScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);

  const emergenciesQuery = useQuery({
    queryKey: ['boss-schedule-emergencies'],
    queryFn: () => withCurrentToken((token) => fetchEmergencyCalls(token, { mode: 'scheduled' })),
  });

  const groups = useMemo(() => {
    const scheduled = (emergenciesQuery.data ?? []).filter(
      (c) => c.dispatchMode === 'scheduled' && c.status !== 'completed',
    );
    return groupByDay(scheduled);
  }, [emergenciesQuery.data]);

  const todayKey = getTodayKey();
  const todayCount = groups.find((g) => g.dateKey === todayKey)?.calls.length ?? 0;

  if (!bootstrap) return <LoadingScreen label="Cargando agenda..." />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={emergenciesQuery.isRefetching}
          onRefresh={() => void emergenciesQuery.refetch()}
        />
      }
    >
      <SectionCard
        title="Agenda"
        subtitle={
          todayCount > 0
            ? `${todayCount} servicio${todayCount > 1 ? 's' : ''} programado${todayCount > 1 ? 's' : ''} para hoy.`
            : 'Emergencias programadas por fecha.'
        }
      />

      {emergenciesQuery.isLoading ? <LoadingScreen variant="skeleton" /> : null}

      {emergenciesQuery.error ? (
        <SectionCard title="Error">
          <Text style={styles.error}>
            {emergenciesQuery.error instanceof Error
              ? emergenciesQuery.error.message
              : 'No se pudo cargar la agenda.'}
          </Text>
        </SectionCard>
      ) : null}

      {!emergenciesQuery.isLoading && !emergenciesQuery.error && groups.length === 0 ? (
        <EmptyState
          icon="📅"
          title="Sin servicios programados"
          subtitle="Los servicios con fecha y hora aparecerán aquí organizados por día."
        />
      ) : null}

      {groups.map((group) => (
        <DaySection
          key={group.dateKey}
          group={group}
          isToday={group.dateKey === todayKey}
          locale={bootstrap.companyConfig.locale}
          onPress={(callId) => pushAppRoute(appRoutes.bossQueueDetail(callId, 'emergency'))}
        />
      ))}
    </ScrollView>
  );
}

function DaySection(props: {
  group: DayGroup;
  isToday: boolean;
  locale: string;
  onPress: (callId: string) => void;
}) {
  const { group, isToday, onPress } = props;

  return (
    <View style={styles.daySection}>
      <View style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
        <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{group.label}</Text>
        <Text style={styles.dayCount}>
          {group.calls.length} servicio{group.calls.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.dayCards}>
        {group.calls.map((call) => (
          <ScheduleCard key={call.id} call={call} onPress={() => onPress(call.id)} />
        ))}
      </View>
    </View>
  );
}

function ScheduleCard(props: {
  call: MarketplaceEmergencyCall;
  onPress: () => void;
}) {
  const { call, onPress } = props;
  const timeLabel = call.scheduledTime ?? '—';

  return (
    <PressableCard
      title={call.location || 'Sin ubicacion'}
      subtitle={call.issue || 'Sin descripcion'}
      meta={call.assignedEmployeeName || call.assignedEmployeeEmail || 'Sin tecnico asignado'}
      onPress={onPress}
    >
      <View style={styles.cardRow}>
        <Text style={styles.timeChip}>{timeLabel}</Text>
        <StatusBadge status={call.status} type="emergency" />
      </View>
      {call.clientName || call.clientEmail ? (
        <Text style={styles.clientLine}>
          Cliente: {call.clientName || call.clientEmail}
        </Text>
      ) : null}
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
  daySection: {
    gap: spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.textMuted,
    paddingLeft: 12,
  },
  dayHeaderToday: {
    borderLeftColor: '#0B5FFF',
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  dayLabelToday: {
    color: '#0B5FFF',
  },
  dayCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dayCards: {
    gap: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeChip: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B5FFF',
    backgroundColor: '#EBF1FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  clientLine: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
});
