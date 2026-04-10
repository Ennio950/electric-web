import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signOut } from 'firebase/auth';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { FilterChips } from '@/src/components/FilterChips';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { StatusBadge } from '@/src/components/StatusBadge';
import { auth } from '@/src/config/firebase';
import {
  useClientEmergencyCallsQuery,
  useClientRequestDetailQuery,
  useClientRequestsQuery,
  useMobileHomeQuery,
} from '@/src/hooks/useMobileDataQueries';
import { createClientRequest, withCurrentToken } from '@/src/lib/api';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import { compressImageForUpload, uploadImageAsset } from '@/src/lib/imageUpload';
import { captureImageFromCamera, pickImageFromLibrary } from '@/src/lib/media';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, layout, radii, spacing } from '@/src/theme';
import type { MarketplaceEmergencyCall, MarketplaceRequest, MobileHomeResponse } from '@/src/types/api';

type ClientCategory = 'electricidad' | 'plomeria' | 'general';
const CLIENT_ACTIVE_REQUEST_LIMIT = 3;

const CATEGORY_OPTIONS: Array<{ label: string; value: ClientCategory }> = [
  { label: 'Electricidad', value: 'electricidad' },
  { label: 'Plomeria', value: 'plomeria' },
  { label: 'General', value: 'general' },
];

const METRIC_ACCENTS = {
  solicitudes: { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  activas:     { color: '#fcd34d', bg: 'rgba(245,200,66,0.12)' },
  tuAccion:    { color: '#6ee7b7', bg: 'rgba(16,185,129,0.12)' },
  emergencias: { color: '#fca5a5', bg: 'rgba(239,68,68,0.12)' },
} as const;

// ─── Status accent for request cards ─────────────────────────────────────────
const STATUS_ACCENT: Record<string, string> = {
  EN_ESPERA:                  '#fcd34d',
  ASIGNADO:                   '#38bdf8',
  NEGOCIANDO:                 '#fbbf24',
  EN_PROCESO:                 '#6ee7b7',
  ESPERANDO_CIERRE_CLIENTE:   '#fbbf24',
  ESPERANDO_COMPROBANTE_PAGO: '#fbbf24',
  PAGO_PENDIENTE_REVISION:    '#fca5a5',
  COMPLETADO:                 '#6ee7b7',
  CANCELADO:                  '#64748b',
};

function statusAccent(status: string | null | undefined): string {
  return STATUS_ACCENT[String(status || '').trim().toUpperCase()] ?? '#38bdf8';
}

export default function ClientHomeScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const setNotice = useSessionStore((state) => state.setNotice);
  const queryClient = useQueryClient();
  const addressInputRef = useRef<TextInput | null>(null);

  const homeQuery = useMobileHomeQuery();
  const requestsQuery = useClientRequestsQuery();
  const emergenciesQuery = useClientEmergencyCallsQuery();

  const [category, setCategory] = useState<ClientCategory>('electricidad');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const detailQuery = useClientRequestDetailQuery(selectedRequestId);

  const requests = useMemo(() => {
    const next = [...(requestsQuery.data ?? [])];
    next.sort(sortRecordsByDate);
    return next;
  }, [requestsQuery.data]);

  const activeRequestCount = useMemo(() => {
    return requests.filter(isRequestActive).length;
  }, [requests]);

  const activeEmergencies = useMemo(() => {
    const next = [...(emergenciesQuery.data ?? [])];
    next.sort(sortRecordsByDate);
    return next.filter((call) => String(call.status || '').trim().toLowerCase() !== 'completed');
  }, [emergenciesQuery.data]);

  useEffect(() => {
    if (!requests.length) {
      if (selectedRequestId) {
        setSelectedRequestId(null);
      }
      return;
    }

    const stillExists = selectedRequestId ? requests.some((request) => request.id === selectedRequestId) : false;
    if (!stillExists) {
      setSelectedRequestId(requests[0].id);
    }
  }, [requests, selectedRequestId]);

  useEffect(() => {
    setShowComposer(activeRequestCount === 0);
  }, [activeRequestCount]);

  const homeData = homeQuery.data as MobileHomeResponse | undefined;
  const summary = homeData?.role === 'client' ? homeData.summary : null;
  const visibleRequests = requests.slice(0, 6);
  const canCreateMoreRequests = activeRequestCount < CLIENT_ACTIVE_REQUEST_LIMIT;

  const canSubmit = Boolean(address.trim() && description.trim()) && canCreateMoreRequests;
  const isRefreshing = homeQuery.isRefetching
    || requestsQuery.isRefetching
    || emergenciesQuery.isRefetching
    || detailQuery.isRefetching;

  const createMutation = useMutation({
    mutationFn: () =>
      withCurrentToken((token) =>
        createClientRequest(token, {
          category,
          address: address.trim(),
          description: description.trim(),
          photoUrl: photoUrl.trim() || undefined,
        }),
      ),
    onSuccess: async (request) => {
      setCategory('electricidad');
      setAddress('');
      setDescription('');
      setPhotoUrl('');
      setShowComposer(false);
      setSelectedRequestId(request.id);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
      ]);
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (source: 'library' | 'camera') => {
      if (!bootstrap) {
        throw new Error('Bootstrap no disponible.');
      }

      const pickedImage = source === 'camera'
        ? await captureImageFromCamera()
        : await pickImageFromLibrary();

      if (!pickedImage) {
        return null;
      }

      const compressed = await compressImageForUpload(pickedImage, bootstrap.companyConfig.photoPolicy);
      return withCurrentToken(async (token) => {
        const uploaded = await uploadImageAsset({ token, asset: compressed });
        return uploaded.url;
      });
    },
    onSuccess: (uploadedUrl) => {
      if (uploadedUrl) {
        setPhotoUrl(uploadedUrl);
      }
    },
  });

  async function handleRefresh() {
    const tasks: Array<Promise<unknown>> = [
      homeQuery.refetch(),
      requestsQuery.refetch(),
      emergenciesQuery.refetch(),
    ];

    if (selectedRequestId) {
      tasks.push(detailQuery.refetch());
    }

    await Promise.all(tasks);
  }

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    try {
      setIsSigningOut(true);
      await signOut(auth);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cerrar sesion.';
      setNotice(message);
    } finally {
      setIsSigningOut(false);
    }
  }

  function handleOpenComposer() {
    if (!canCreateMoreRequests) {
      return;
    }
    setShowComposer(true);
    setTimeout(() => {
      addressInputRef.current?.focus();
    }, 120);
  }

  if (!bootstrap) {
    return <LoadingScreen label="Cargando panel cliente..." />;
  }

  const company = bootstrap.companyConfig;
  const userName = bootstrap.user.displayName || bootstrap.user.email || 'Cliente';
  const avatarLetter = userName.charAt(0).toUpperCase();
  const totalRequests = summary?.totalRequests ?? requests.length;
  const activeRequests = summary?.activeRequests ?? activeRequestCount;
  const awaitingAction = summary?.awaitingMyAction ?? requests.filter(isRequestAwaitingClient).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
      }
    >
      {/* ── HERO ─────────────────────────────────────────────── */}
      <View style={styles.heroCard}>
        <View style={styles.heroGlow1} />
        <View style={styles.heroGlow2} />

        <View style={styles.heroTopRow}>
          <Text style={styles.heroEyebrow}>PANEL CLIENTE</Text>
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBadgeText}>activo</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>{company.companyName}</Text>

        {/* User identity row */}
        <View style={styles.identityRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>{avatarLetter}</Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.identityValue}>{userName}</Text>
            <Text style={styles.identityMeta}>{bootstrap.user.email || 'Sin correo visible'}</Text>
          </View>
        </View>

        {/* Metrics */}
        <View style={styles.metricGrid}>
          <SummaryMetric
            label="Solicitudes"
            value={totalRequests}
            accent={METRIC_ACCENTS.solicitudes.color}
            accentBg={METRIC_ACCENTS.solicitudes.bg}
          />
          <SummaryMetric
            label="Activas"
            value={activeRequests}
            accent={METRIC_ACCENTS.activas.color}
            accentBg={METRIC_ACCENTS.activas.bg}
          />
          <SummaryMetric
            label="Tu accion"
            value={awaitingAction}
            accent={METRIC_ACCENTS.tuAccion.color}
            accentBg={METRIC_ACCENTS.tuAccion.bg}
          />
          <SummaryMetric
            label="Emergencias"
            value={activeEmergencies.length}
            accent={METRIC_ACCENTS.emergencias.color}
            accentBg={METRIC_ACCENTS.emergencias.bg}
          />
        </View>

        {/* Primary CTA */}
        <Pressable
          accessibilityRole="button"
          onPress={() => pushAppRoute(appRoutes.clientEmergencyNew)}
          style={({ pressed }) => [styles.emergencyBtn, pressed && styles.emergencyBtnPressed]}
        >
          <Text style={styles.emergencyBtnLabel}>Emergencia</Text>
          <Text style={styles.emergencyBtnSub}>Soporte urgente ahora</Text>
        </Pressable>

        {/* Secondary actions */}
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={handleOpenComposer}
            disabled={!canCreateMoreRequests}
            style={({ pressed }) => [styles.actionBtn, !canCreateMoreRequests && styles.actionBtnDisabled, pressed && styles.actionBtnPressed]}
          >
            <Text style={styles.actionBtnLabel}>Nueva solicitud</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleRefresh()}
            disabled={isRefreshing}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          >
            {isRefreshing
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={styles.actionBtnLabel}>Actualizar</Text>
            }
          </Pressable>
        </View>

        {/* Sign out — subtle link style */}
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleSignOut()}
          disabled={isSigningOut}
          style={styles.signOutRow}
        >
          {isSigningOut
            ? <ActivityIndicator size="small" color={colors.textMuted} />
            : <Text style={styles.signOutLabel}>Cerrar sesion</Text>
          }
        </Pressable>
      </View>

      {/* ── ERROR BANNER ──────────────────────────────────────── */}
      {(homeQuery.error || requestsQuery.error || emergenciesQuery.error) ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>No se pudo sincronizar todo el panel.</Text>
          <Text style={styles.errorMessage}>
            {firstErrorMessage(homeQuery.error, requestsQuery.error, emergenciesQuery.error)}
          </Text>
        </View>
      ) : null}

      {/* ── NUEVA SOLICITUD ───────────────────────────────────── */}
      <View style={styles.panelCard}>
        <Pressable
          accessibilityRole="button"
          disabled={!canCreateMoreRequests && !showComposer}
          style={styles.sectionToggle}
          onPress={() => setShowComposer((current) => !current)}
        >
          <View style={styles.sectionToggleLeft}>
            <View style={[styles.sectionAccentBar, { backgroundColor: canCreateMoreRequests ? colors.accent : colors.textMuted }]} />
            <View>
              <Text style={styles.sectionTitle}>Nueva solicitud</Text>
              <Text style={styles.sectionSubtitle}>
                {activeRequestCount >= CLIENT_ACTIVE_REQUEST_LIMIT
                  ? `Limite de ${CLIENT_ACTIVE_REQUEST_LIMIT} activas alcanzado.`
                  : activeRequestCount > 0
                    ? `${activeRequestCount} activa${activeRequestCount === 1 ? '' : 's'} — formulario plegado.`
                    : 'Categoria, direccion, descripcion y foto.'}
              </Text>
            </View>
          </View>
          <View style={[styles.togglePill, !canCreateMoreRequests && styles.togglePillDisabled]}>
            <Text style={styles.togglePillText}>
              {activeRequestCount >= CLIENT_ACTIVE_REQUEST_LIMIT ? 'Limite' : showComposer ? 'Ocultar' : 'Abrir'}
            </Text>
          </View>
        </Pressable>

        {activeRequestCount > 0 && activeRequestCount < CLIENT_ACTIVE_REQUEST_LIMIT ? (
          <View style={styles.inlineInfo}>
            <Text style={styles.infoMessage}>
              Tienes trabajo activo. El formulario se pliega automaticamente para priorizar seguimiento.
            </Text>
          </View>
        ) : null}

        {activeRequestCount >= CLIENT_ACTIVE_REQUEST_LIMIT ? (
          <View style={styles.inlineError}>
            <Text style={styles.errorMessage}>
              Maximo 3 solicitudes activas por cliente. Completa o cancela una antes de crear otra.
            </Text>
          </View>
        ) : null}

        {showComposer ? (
          <View style={styles.formStack}>
            <FieldLabel>Categoria</FieldLabel>
            <FilterChips value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />

            <FieldLabel>Direccion</FieldLabel>
            <TextInput
              ref={addressInputRef}
              placeholder="Ej: Av. Principal 123"
              placeholderTextColor={colors.textPlaceholder}
              style={styles.input}
              value={address}
              onChangeText={setAddress}
            />

            <FieldLabel>Descripcion del problema</FieldLabel>
            <TextInput
              multiline
              numberOfLines={5}
              placeholder="Describe que necesitas y cualquier detalle importante."
              placeholderTextColor={colors.textPlaceholder}
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
            />

            <FieldLabel>Foto opcional</FieldLabel>
            <View style={styles.inlineActionRow}>
              <AppButton
                tone="secondary"
                size="sm"
                loading={uploadPhotoMutation.isPending}
                disabled={createMutation.isPending}
                onPress={() => uploadPhotoMutation.mutate('library')}
              >
                Galeria
              </AppButton>
              <AppButton
                tone="secondary"
                size="sm"
                loading={uploadPhotoMutation.isPending}
                disabled={createMutation.isPending}
                onPress={() => uploadPhotoMutation.mutate('camera')}
              >
                Camara
              </AppButton>
            </View>
            <Text style={photoUrl ? styles.helperSuccess : styles.helperText}>
              {photoUrl ? 'Foto lista para enviar.' : 'La foto es opcional.'}
            </Text>

            {(uploadPhotoMutation.error || createMutation.error) ? (
              <View style={styles.inlineError}>
                <Text style={styles.errorMessage}>
                  {firstErrorMessage(uploadPhotoMutation.error, createMutation.error)}
                </Text>
              </View>
            ) : null}

            <AppButton
              onPress={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!canSubmit || uploadPhotoMutation.isPending}
            >
              Crear solicitud
            </AppButton>
          </View>
        ) : null}
      </View>

      {/* ── EMERGENCIAS ACTIVAS ───────────────────────────────── */}
      {activeEmergencies.length ? (
        <View style={styles.panelCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionAccentBar, { backgroundColor: '#fca5a5' }]} />
            <View>
              <Text style={styles.sectionTitle}>Emergencias activas</Text>
              <Text style={styles.sectionSubtitle}>{activeEmergencies.length} en curso</Text>
            </View>
          </View>

          <View style={styles.stack}>
            {activeEmergencies.slice(0, 2).map((call) => (
              <EmergencyCard
                key={call.id}
                call={call}
                locale={company.locale}
                timezone={company.timezone}
                onPress={() => pushAppRoute(appRoutes.clientEmergencyDetail(call.id))}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* ── MIS SOLICITUDES ──────────────────────────────────── */}
      <View style={styles.panelCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionAccentBar, { backgroundColor: colors.primary }]} />
          <View>
            <Text style={styles.sectionTitle}>Mis solicitudes</Text>
            <Text style={styles.sectionSubtitle}>
              Toca una para ver el detalle abajo.
            </Text>
          </View>
        </View>

        {requestsQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : requests.length ? (
          <View style={styles.stack}>
            {visibleRequests.map((request) => (
              <RequestListItem
                key={request.id}
                request={request}
                locale={company.locale}
                timezone={company.timezone}
                currency={company.currency}
                selected={request.id === selectedRequestId}
                onPress={() => setSelectedRequestId(request.id)}
              />
            ))}
          </View>
        ) : (
          <EmptyPanel
            title="Sin solicitudes aun"
            subtitle="Usa el formulario superior para crear tu primera solicitud."
          />
        )}

        <AppButton tone="secondary" onPress={() => pushAppRoute(appRoutes.clientRequests)}>
          Ver historial completo
        </AppButton>
      </View>

      {/* ── DETALLE ──────────────────────────────────────────── */}
      <View style={styles.panelCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionAccentBar, { backgroundColor: colors.accent }]} />
          <View>
            <Text style={styles.sectionTitle}>Detalle</Text>
            <Text style={styles.sectionSubtitle}>
              Solicitud seleccionada con acceso al flujo completo.
            </Text>
          </View>
        </View>

        {!selectedRequestId ? (
          <EmptyPanel
            title="Selecciona una solicitud"
            subtitle="Toca una tarjeta arriba para cargar el detalle aqui."
          />
        ) : detailQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : detailQuery.error || !detailQuery.data ? (
          <EmptyPanel
            title="No se pudo cargar el detalle"
            subtitle={firstErrorMessage(detailQuery.error)}
          />
        ) : (
          <RequestDetailPanel request={detailQuery.data} company={company} />
        )}
      </View>
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryMetric(props: {
  label: string;
  value: number;
  accent: string;
  accentBg: string;
}) {
  const { label, value, accent, accentBg } = props;

  return (
    <View style={[styles.metricCard, { backgroundColor: accentBg, borderColor: `${accent}28` }]}>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={[styles.metricAccentBar, { backgroundColor: accent }]} />
    </View>
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
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.emergencyCard, pressed && styles.requestCardPressed]}
    >
      <View style={styles.requestHeader}>
        <StatusBadge status={call.status} type="emergency" />
        <Text style={styles.requestDate}>
          {formatDateTime(call.updatedAt || call.createdAt, locale, timezone)}
        </Text>
      </View>
      <Text style={styles.requestTitle}>{call.location || 'Emergencia sin ubicacion'}</Text>
      {call.issue ? <Text style={styles.requestBody}>{call.issue}</Text> : null}
    </Pressable>
  );
}

function RequestListItem(props: {
  request: MarketplaceRequest;
  locale: string;
  timezone: string;
  currency: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { request, locale, timezone, currency, selected, onPress } = props;
  const accent = statusAccent(request.status);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.requestCard,
        selected ? styles.requestCardSelected : null,
        pressed ? styles.requestCardPressed : null,
      ]}
    >
      <View style={[styles.requestAccentBar, { backgroundColor: accent }]} />
      <View style={styles.requestCardInner}>
        <View style={styles.requestHeader}>
          <StatusBadge status={request.status} type="request" />
          <Text style={styles.requestDate}>{formatDateTime(request.updatedAt || request.createdAt, locale, timezone)}</Text>
        </View>
        <Text style={styles.requestTitle}>{request.address || 'Solicitud sin direccion'}</Text>
        <Text style={styles.requestBody} numberOfLines={2}>{request.description || 'Sin descripcion'}</Text>
        <View style={styles.requestFooter}>
          <Text style={styles.requestMeta}>{request.category || 'General'}</Text>
          {request.finalAmount != null ? (
            <Text style={[styles.requestMeta, { color: colors.success }]}>
              {formatCurrency(request.finalAmount, currency, locale)}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function RequestDetailPanel(props: {
  request: MarketplaceRequest;
  company: { currency: string; locale: string; timezone: string };
}) {
  const { request, company } = props;
  const accent = statusAccent(request.status);
  const initialPhotoUrl = request.photoUrl ?? '';

  return (
    <View style={styles.detailPanel}>
      <View style={[styles.detailAccentStrip, { backgroundColor: accent }]} />

      <View style={styles.detailPanelInner}>
        <View style={styles.detailHeader}>
          <StatusBadge status={request.status} type="request" />
          <Text style={styles.detailDate}>
            {formatDateTime(request.updatedAt || request.createdAt, company.locale, company.timezone)}
          </Text>
        </View>

        <Text style={styles.detailTitle}>{request.address || 'Solicitud sin direccion'}</Text>
        {request.description ? (
          <Text style={styles.detailBody}>{request.description}</Text>
        ) : null}

        <View style={styles.detailGrid}>
          <DetailItem label="Categoria" value={request.category || 'General'} />
          {(request.employeeName || request.employeeEmail) ? (
            <DetailItem label="Tecnico" value={request.employeeName || request.employeeEmail || ''} />
          ) : null}
          {request.finalAmount != null ? (
            <DetailItem
              label="Monto final"
              value={formatCurrency(request.finalAmount, company.currency, company.locale)}
              accent={colors.success}
            />
          ) : null}
          <DetailItem
            label="Creada"
            value={formatDateTime(request.createdAt, company.locale, company.timezone)}
          />
        </View>

        <View style={styles.inlineActionRow}>
          <AppButton onPress={() => pushAppRoute(appRoutes.clientRequestDetail(request.id))}>
            Abrir detalle completo
          </AppButton>
          {initialPhotoUrl ? (
            <AppButton tone="secondary" onPress={() => void Linking.openURL(initialPhotoUrl)}>
              Ver foto
            </AppButton>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function DetailItem(props: { label: string; value: string; accent?: string }) {
  const { label, value, accent } = props;

  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailItemLabel}>{label}</Text>
      <Text style={[styles.detailItemValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

function EmptyPanel(props: { title: string; subtitle: string }) {
  const { title, subtitle } = props;

  return (
    <View style={styles.emptyPanel}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

function FieldLabel(props: { children: string }) {
  return <Text style={styles.fieldLabel}>{props.children}</Text>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortRecordsByDate(a: { updatedAt: string | null; createdAt: string | null }, b: { updatedAt: string | null; createdAt: string | null }) {
  return parseDateMs(b.updatedAt || b.createdAt) - parseDateMs(a.updatedAt || a.createdAt);
}

function parseDateMs(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRequestActive(request: MarketplaceRequest) {
  return !['COMPLETADO', 'CANCELADO'].includes(String(request.status || '').trim().toUpperCase());
}

function isRequestAwaitingClient(request: MarketplaceRequest) {
  const status = String(request.status || '').trim().toUpperCase();
  return status === 'NEGOCIANDO' || status === 'ESPERANDO_CIERRE_CLIENTE' || status === 'ESPERANDO_COMPROBANTE_PAGO';
}

function firstErrorMessage(...errors: unknown[]) {
  const firstError = errors.find((error) => error instanceof Error);
  return firstError instanceof Error ? firstError.message : 'Intenta de nuevo.';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  content: {
    padding: layout.containerPadding,
    gap: spacing.lg,
  },

  // ── Hero ──
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radii.hero,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.14)',
    backgroundColor: '#071525',
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  heroGlow1: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.10)',
  },
  heroGlow2: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(245,200,66,0.08)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(110,231,183,0.3)',
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#6ee7b7',
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6ee7b7',
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: spacing.md,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  identityValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  identityMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },

  // ── Metrics ──
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    position: 'relative',
    overflow: 'hidden',
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  metricAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: radii.xl,
    borderBottomLeftRadius: radii.xl,
  },

  // ── Emergency CTA ──
  emergencyBtn: {
    borderRadius: radii.xl,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  emergencyBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  emergencyBtnLabel: {
    fontSize: 17,
    fontWeight: '900',
    color: '#fca5a5',
    letterSpacing: 0.3,
  },
  emergencyBtnSub: {
    fontSize: 12,
    color: 'rgba(252,165,165,0.7)',
  },

  // ── Action row ──
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },
  actionBtnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // ── Sign out ──
  signOutRow: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  signOutLabel: {
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },

  // ── Panel cards ──
  panelCard: {
    borderRadius: radii.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    padding: layout.cardPadding,
    gap: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionToggleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  sectionAccentBar: {
    width: 3,
    borderRadius: 999,
    alignSelf: 'stretch',
    minHeight: 36,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 2,
  },
  togglePill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'rgba(245,200,66,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  togglePillDisabled: {
    borderColor: colors.textMuted,
    backgroundColor: 'transparent',
  },
  togglePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
  },

  // ── Form ──
  formStack: {
    gap: spacing.md,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  input: {
    minHeight: layout.inputMinHeight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 120,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    textAlignVertical: 'top',
  },
  inlineActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  helperSuccess: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
  },

  // ── Alerts ──
  inlineError: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: colors.errorBg,
    padding: spacing.md,
  },
  inlineInfo: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.primaryPale,
    padding: spacing.md,
  },
  infoMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  errorCard: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: colors.errorBg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.error,
  },
  errorMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.error,
  },

  // ── Stack ──
  stack: {
    gap: spacing.md,
  },

  // ── Emergency card ──
  emergencyCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(252,165,165,0.25)',
    backgroundColor: 'rgba(239,68,68,0.08)',
    padding: spacing.lg,
    gap: spacing.sm,
  },

  // ── Request cards ──
  requestCard: {
    flexDirection: 'row',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    overflow: 'hidden',
  },
  requestCardSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(245,200,66,0.06)',
  },
  requestCardPressed: {
    opacity: 0.88,
  },
  requestAccentBar: {
    width: 4,
  },
  requestCardInner: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requestDate: {
    flexShrink: 1,
    fontSize: 11,
    textAlign: 'right',
    color: colors.textMuted,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  requestBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  requestMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },

  // ── Detail panel ──
  detailPanel: {
    flexDirection: 'row',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    overflow: 'hidden',
  },
  detailAccentStrip: {
    width: 4,
  },
  detailPanelInner: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailDate: {
    flexShrink: 1,
    fontSize: 12,
    textAlign: 'right',
    color: colors.textMuted,
  },
  detailTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  detailBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  detailGrid: {
    gap: spacing.sm,
  },
  detailItem: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  detailItemLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  detailItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // ── Empty ──
  emptyPanel: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
