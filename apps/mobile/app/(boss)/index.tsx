import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { EmptyState } from '@/src/components/EmptyState';
import { PressableCard } from '@/src/components/PressableCard';
import { SectionCard } from '@/src/components/SectionCard';
import { SignOutButton } from '@/src/components/SignOutButton';
import { StatusBadge } from '@/src/components/StatusBadge';
import {
  formatCurrency,
  formatDateTime,
  formatQueueSourceType,
} from '@/src/lib/formatters';
import {
  useBossEmergencyCallsQuery,
  useBossRequestsQuery,
  useBossReviewQueueQuery,
  useMobileHomeQuery,
} from '@/src/hooks/useMobileDataQueries';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useBuilderStore, useCurrentBuilderJob } from '@/src/stores/builderStore';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';
import type {
  BossReviewQueueItem,
  MarketplaceEmergencyCall,
  MarketplaceRequest,
  MobileHomeResponse,
} from '@/src/types/api';

export default function BossHomeScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const homeQuery = useMobileHomeQuery();
  const reviewQueueQuery = useBossReviewQueueQuery('home');
  const requestsQuery = useBossRequestsQuery('home');
  const emergenciesQuery = useBossEmergencyCallsQuery('home');
  const builderJobs = useBuilderStore((state) => state.jobs);
  const createJob = useBuilderStore((state) => state.createJob);
  const currentBuilderJob = useCurrentBuilderJob();

  if (!bootstrap) {
    return null;
  }

  const data = homeQuery.data as MobileHomeResponse | undefined;
  const summary = data && data.role === 'boss' ? data.summary : null;
  const currency = bootstrap.companyConfig.currency;
  const locale = bootstrap.companyConfig.locale;
  const timezone = bootstrap.companyConfig.timezone;

  const priorityReviews = (reviewQueueQuery.data ?? []).slice(0, 2);
  const recentRequests = (requestsQuery.data ?? []).slice(0, 2);
  const activeEmergencies = (emergenciesQuery.data ?? [])
    .filter((call) => call.status !== 'completed')
    .slice(0, 2);

  const handleCreateEstimate = () => {
    const nextNumber = builderJobs.length + 1;
    const job = createJob(`Estimado ${nextNumber}`, currency);
    pushAppRoute(appRoutes.builderJobDetail(job.id));
  };

  const handleContinueEstimate = () => {
    if (currentBuilderJob) {
      pushAppRoute(appRoutes.builderJobDetail(currentBuilderJob.id));
      return;
    }
    handleCreateEstimate();
  };

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
        <View style={styles.heroGlowPrimary} />
        <View style={styles.heroGlowSecondary} />
        <Text style={styles.heroEyebrow}>Boss control</Text>
        <Text style={styles.heroTitle}>Operacion, pagos y estimados en una sola vista.</Text>
        <Text style={styles.heroSubtitle}>
          Resuelve lo urgente, lanza un estimado nuevo y salta a la cola sin pelearte con menus.
        </Text>

        <View style={styles.heroMetaRow}>
          <View style={styles.metaChip}>
            <Ionicons color="#f5c842" name="business-outline" size={14} />
            <Text style={styles.metaChipText}>{bootstrap.companyConfig.companyName}</Text>
          </View>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons color="#7dd3fc" name="calculator-variant-outline" size={15} />
            <Text style={styles.metaChipText}>{builderJobs.length} estimados</Text>
          </View>
        </View>

        <View style={styles.heroActionRow}>
          <View style={styles.heroActionPrimary}>
            <AppButton
              icon={<MaterialCommunityIcons color="#04111d" name="calculator-variant" size={18} />}
              onPress={handleCreateEstimate}
              size="lg"
            >
              Crear estimado
            </AppButton>
          </View>
          <View style={styles.heroActionSecondary}>
            <AppButton
              icon={<Ionicons color={colors.textPrimary} name="git-network-outline" size={18} />}
              onPress={() => pushAppRoute(appRoutes.bossQueue)}
              size="lg"
              tone="secondary"
            >
              Abrir cola
            </AppButton>
          </View>
        </View>
      </View>

      <SectionCard title="Resumen de hoy" subtitle="Lo que mas te conviene tocar primero desde el telefono.">
        <View style={styles.summaryGrid}>
          <SummaryCard
            accentBackground="rgba(56, 189, 248, 0.14)"
            accentColor="#7dd3fc"
            icon={<Ionicons color="#7dd3fc" name="clipboard-outline" size={18} />}
            label="Pendientes"
            value={summary?.pendingRequests ?? 0}
          />
          <SummaryCard
            accentBackground="rgba(248, 113, 113, 0.16)"
            accentColor="#fca5a5"
            icon={<Ionicons color="#fca5a5" name="warning-outline" size={18} />}
            label="Emergencias"
            value={summary?.activeEmergencies ?? 0}
          />
          <SummaryCard
            accentBackground="rgba(245, 200, 66, 0.16)"
            accentColor="#fcd34d"
            icon={<Ionicons color="#fcd34d" name="card-outline" size={18} />}
            label="Pagos"
            value={summary?.pendingPayments ?? 0}
          />
          <SummaryCard
            accentBackground="rgba(167, 139, 250, 0.16)"
            accentColor="#c4b5fd"
            icon={<Ionicons color="#c4b5fd" name="layers-outline" size={18} />}
            label="Revision"
            value={summary?.reviewQueue ?? 0}
          />
        </View>
      </SectionCard>

      <SectionCard title="Acciones rapidas" subtitle="Accesos pensados para uso con una mano.">
        <View style={styles.quickGrid}>
          {bootstrap.featureFlags.builderMobile ? (
            <>
              <QuickActionCard
                accentBackground="rgba(245, 200, 66, 0.16)"
                accentColor="#f5c842"
                icon={<MaterialCommunityIcons color="#f5c842" name="calculator-variant-outline" size={20} />}
                subtitle="Abre un estimado nuevo y entra directo al editor."
                title="Nuevo estimado"
                onPress={handleCreateEstimate}
              />
              <QuickActionCard
                accentBackground="rgba(56, 189, 248, 0.16)"
                accentColor="#7dd3fc"
                icon={<Ionicons color="#7dd3fc" name="document-text-outline" size={20} />}
                subtitle="PDF, cotizaciones guardadas y detalle de estimados."
                title="Historial"
                onPress={() => pushAppRoute(appRoutes.builderEstimateHistory)}
              />
            </>
          ) : null}

          <QuickActionCard
            accentBackground="rgba(16, 185, 129, 0.16)"
            accentColor="#6ee7b7"
            icon={<Ionicons color="#6ee7b7" name="receipt-outline" size={20} />}
            subtitle="Genera factura nueva desde el modulo builder."
            title="Nueva factura"
            onPress={() => pushAppRoute(appRoutes.builderInvoiceNew)}
          />
          <QuickActionCard
            accentBackground="rgba(56, 189, 248, 0.16)"
            accentColor="#7dd3fc"
            icon={<Ionicons color="#7dd3fc" name="calendar-clear-outline" size={20} />}
            subtitle="Revisa servicios programados y huecos del dia."
            title="Agenda"
            onPress={() => pushAppRoute(appRoutes.bossSchedule)}
          />
          <QuickActionCard
            accentBackground="rgba(139, 92, 246, 0.16)"
            accentColor="#c4b5fd"
            icon={<Ionicons color="#c4b5fd" name="shield-checkmark-outline" size={20} />}
            subtitle="Aprobaciones, earning y solicitudes internas."
            title="Admin"
            onPress={() => pushAppRoute(appRoutes.bossAdmin)}
          />
          <QuickActionCard
            accentBackground="rgba(148, 163, 184, 0.14)"
            accentColor="#cbd5e1"
            icon={<Ionicons color="#cbd5e1" name="settings-outline" size={20} />}
            subtitle="Empresa, alertas y configuracion operativa."
            title="Config"
            onPress={() => pushAppRoute(appRoutes.bossSettings)}
          />
        </View>
      </SectionCard>

      {bootstrap.featureFlags.builderMobile ? (
        <SectionCard title="Builder movil" subtitle="Estimados y facturas sin salir del flujo boss.">
          <View style={styles.builderPanel}>
            <View style={styles.builderHeaderRow}>
              <View style={styles.builderIconWrap}>
                <MaterialCommunityIcons color="#f5c842" name="calculator-variant-outline" size={20} />
              </View>
              <View style={styles.builderHeaderText}>
                <Text style={styles.builderTitle}>Estimador listo</Text>
                <Text style={styles.builderSubtitle}>
                  {currentBuilderJob
                    ? `Ultimo estimado: ${currentBuilderJob.name}`
                    : 'Crea un estimado nuevo y arranca desde el movil.'}
                </Text>
              </View>
            </View>

            <View style={styles.builderMetaRow}>
              <Text style={styles.builderMetaLabel}>Base local</Text>
              <Text style={styles.builderMetaValue}>
                {builderJobs.length} estimados guardados
              </Text>
            </View>

            <View style={styles.builderButtonRow}>
              <View style={styles.builderButtonPrimary}>
                <AppButton
                  icon={<MaterialCommunityIcons color="#04111d" name="plus" size={18} />}
                  onPress={handleCreateEstimate}
                >
                  Nuevo
                </AppButton>
              </View>
              <View style={styles.builderButtonSecondary}>
                <AppButton
                  icon={<Ionicons color={colors.textPrimary} name="play-forward-outline" size={18} />}
                  onPress={handleContinueEstimate}
                  tone="secondary"
                >
                  Continuar
                </AppButton>
              </View>
            </View>
          </View>
        </SectionCard>
      ) : null}

      <SectionCard title="En foco" subtitle="Lo urgente y reciente para seguir sin perder contexto.">
        {priorityReviews.length ? (
          <View style={styles.stack}>
            {priorityReviews.map((row) => (
              <ReviewPreviewCard
                key={row.queueId}
                currency={currency}
                locale={locale}
                onPress={() => pushAppRoute(appRoutes.bossPaymentDetail(row.recordId, row.sourceType))}
                row={row}
                timezone={timezone}
              />
            ))}
          </View>
        ) : null}

        {!priorityReviews.length && !activeEmergencies.length && !recentRequests.length ? (
          <EmptyState
            icon="OK"
            subtitle="No hay items urgentes por revisar en este momento."
            title="Tablero despejado"
          />
        ) : null}

        {activeEmergencies.length ? (
          <View style={styles.stack}>
            <Text style={styles.groupLabel}>Emergencias activas</Text>
            {activeEmergencies.map((call) => (
              <EmergencyPreviewCard
                key={call.id}
                call={call}
                locale={locale}
                onPress={() => pushAppRoute(appRoutes.bossQueueDetail(call.id, 'emergency'))}
                timezone={timezone}
              />
            ))}
          </View>
        ) : null}

        {recentRequests.length ? (
          <View style={styles.stack}>
            <Text style={styles.groupLabel}>Requests recientes</Text>
            {recentRequests.map((request) => (
              <RequestPreviewCard
                key={request.id}
                locale={locale}
                onPress={() => pushAppRoute(appRoutes.bossQueueDetail(request.id, 'request'))}
                request={request}
                timezone={timezone}
              />
            ))}
          </View>
        ) : null}
      </SectionCard>

      {homeQuery.error instanceof Error ? <Text style={styles.error}>{homeQuery.error.message}</Text> : null}

      <SectionCard title="Sesion">
        <SignOutButton />
      </SectionCard>
    </ScrollView>
  );
}

function SummaryCard(props: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accentColor: string;
  accentBackground: string;
}) {
  const { icon, label, value, accentColor, accentBackground } = props;

  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIconWrap, { backgroundColor: accentBackground }]}>
        {icon}
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={[styles.summaryAccent, { backgroundColor: accentColor }]} />
    </View>
  );
}

function QuickActionCard(props: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accentColor: string;
  accentBackground: string;
  onPress: () => void;
}) {
  const { icon, title, subtitle, accentColor, accentBackground, onPress } = props;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickCard, pressed ? styles.quickCardPressed : null]}>
      <View style={[styles.quickIconWrap, { backgroundColor: accentBackground }]}>
        {icon}
      </View>
      <Text style={[styles.quickTitle, { color: accentColor }]}>{title}</Text>
      <Text style={styles.quickSubtitle}>{subtitle}</Text>
    </Pressable>
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
      title={row.address || row.description || 'Revision pendiente'}
      subtitle={row.employeeName || row.employeeEmail || 'Sin tecnico asignado'}
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
      title={request.address || 'Solicitud sin direccion'}
      subtitle={request.description || 'Sin descripcion'}
      meta={formatDateTime(request.updatedAt || request.createdAt, locale, timezone)}
      onPress={onPress}
    >
      <StatusBadge status={request.status} type="request" />
      <Text style={styles.metaLine}>
        {request.employeeName || request.clientNickname || request.clientEmail || 'Sin dato'}
      </Text>
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
      title={call.location || 'Emergencia sin ubicacion'}
      subtitle={call.issue || 'Sin detalle'}
      meta={formatDateTime(call.updatedAt || call.createdAt, locale, timezone)}
      onPress={onPress}
    >
      <StatusBadge status={call.status} type="emergency" />
      <Text style={styles.metaLine}>
        {call.assignedEmployeeName || call.clientName || call.clientEmail || 'Sin dato'}
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
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.16)',
    backgroundColor: '#071120',
    padding: 22,
    gap: 16,
  },
  heroGlowPrimary: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(124,58,237,0.26)',
  },
  heroGlowSecondary: {
    position: 'absolute',
    bottom: -60,
    left: -30,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.12)',
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: '#f5c842',
  },
  heroTitle: {
    maxWidth: 280,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '900',
    color: '#f8fbff',
  },
  heroSubtitle: {
    maxWidth: 320,
    fontSize: 15,
    lineHeight: 22,
    color: '#aac1d8',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(8,15,34,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d7e6f3',
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroActionPrimary: {
    flex: 1.15,
  },
  heroActionSecondary: {
    flex: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryCard: {
    position: 'relative',
    minWidth: '47%',
    flexGrow: 1,
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(10,19,39,0.86)',
    padding: 16,
    gap: 8,
  },
  summaryIconWrap: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    padding: 10,
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: '900',
    color: '#f8fbff',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#9fb5cb',
  },
  summaryAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickCard: {
    width: '47%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(11,18,36,0.92)',
    padding: 16,
    gap: 10,
  },
  quickCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  quickIconWrap: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    padding: 10,
  },
  quickTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  quickSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#8ea7bf',
  },
  builderPanel: {
    gap: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245,200,66,0.18)',
    backgroundColor: 'rgba(11,18,36,0.92)',
    padding: 16,
  },
  builderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  builderIconWrap: {
    borderRadius: 16,
    backgroundColor: 'rgba(245,200,66,0.16)',
    padding: 12,
  },
  builderHeaderText: {
    flex: 1,
    gap: 4,
  },
  builderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fbff',
  },
  builderSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#99b0c7',
  },
  builderMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  builderMetaLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#7086a0',
  },
  builderMetaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dce8f4',
  },
  builderButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  builderButtonPrimary: {
    flex: 1,
  },
  builderButtonSecondary: {
    flex: 1,
  },
  stack: {
    gap: spacing.md,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: '#7dd3fc',
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fbff',
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
