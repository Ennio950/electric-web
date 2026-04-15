import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { KeyValueList } from '@/src/components/KeyValueList';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { OperationalChatCard } from '@/src/components/OperationalChatCard';
import { SectionCard } from '@/src/components/SectionCard';
import {
  approveEmergencyPayment,
  approveRequestPayment,
  fetchEmergencyDetail,
  fetchRequestDetail,
  rejectEmergencyPayment,
  rejectRequestPayment,
  withCurrentToken,
} from '@/src/lib/api';
import {
  formatCurrency,
  formatDateTime,
  formatEmergencyStatus,
  formatQueueSourceType,
  formatRequestStatus,
} from '@/src/lib/formatters';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';
import type { MarketplaceEmergencyCall, MarketplaceRequest } from '@/src/types/api';

export default function BossPaymentDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; sourceType?: string }>();
  const recordId = typeof params.id === 'string' ? params.id : '';
  const sourceType = params.sourceType === 'emergency' ? 'emergency' : 'request';
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState('');

  const requestQuery = useQuery({
    queryKey: ['boss-payment-detail', 'request', recordId],
    enabled: Boolean(recordId) && sourceType === 'request',
    queryFn: () => withCurrentToken((token) => fetchRequestDetail(token, recordId)),
  });

  const emergencyQuery = useQuery({
    queryKey: ['boss-payment-detail', 'emergency', recordId],
    enabled: Boolean(recordId) && sourceType === 'emergency',
    queryFn: () => withCurrentToken((token) => fetchEmergencyDetail(token, recordId)),
  });

  const requestApproveMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => approveRequestPayment(token, recordId)),
    onSuccess: async () => {
      await invalidatePaymentQueries(queryClient, 'request', recordId);
    },
  });

  const emergencyApproveMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => approveEmergencyPayment(token, recordId)),
    onSuccess: async () => {
      await invalidatePaymentQueries(queryClient, 'emergency', recordId);
    },
  });

  const requestRejectMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => rejectRequestPayment(token, recordId, rejectionReason.trim())),
    onSuccess: async () => {
      setRejectionReason('');
      await invalidatePaymentQueries(queryClient, 'request', recordId);
    },
  });

  const emergencyRejectMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => rejectEmergencyPayment(token, recordId, rejectionReason.trim())),
    onSuccess: async () => {
      setRejectionReason('');
      await invalidatePaymentQueries(queryClient, 'emergency', recordId);
    },
  });

  if (!bootstrap || !recordId) {
    return <LoadingScreen label="Cargando pago..." />;
  }

  if (sourceType === 'emergency') {
    const detailQuery = emergencyQuery;
    const approveMutation = emergencyApproveMutation;
    const rejectMutation = emergencyRejectMutation;

    if (detailQuery.isLoading) {
      return <LoadingScreen label="Cargando pago..." />;
    }

    if (detailQuery.error || !detailQuery.data) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <SectionCard
            title="No se pudo cargar el pago"
            subtitle={detailQuery.error instanceof Error ? detailQuery.error.message : 'Intenta de nuevo.'}
          />
        </ScrollView>
      );
    }

    const call = detailQuery.data;
    const isBusy = approveMutation.isPending || rejectMutation.isPending;
    const mutationError = approveMutation.error instanceof Error
      ? approveMutation.error.message
      : rejectMutation.error instanceof Error
        ? rejectMutation.error.message
        : null;

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={detailQuery.isRefetching} onRefresh={() => void detailQuery.refetch()} />}
      >
        <SectionCard title="Revision de emergencia" subtitle={call.location || 'Sin ubicacion'}>
          <Text style={styles.eyebrow}>{formatQueueSourceType(sourceType)}</Text>
          <Text style={styles.status}>{formatEmergencyStatus(call.status)}</Text>
        </SectionCard>

        <EmergencyPaymentSummary
          call={call}
          currency={bootstrap.companyConfig.currency}
          locale={bootstrap.companyConfig.locale}
          timezone={bootstrap.companyConfig.timezone}
        />

        <DecisionCard
          rejectionReason={rejectionReason}
          setRejectionReason={setRejectionReason}
          isBusy={isBusy}
          approveLoading={approveMutation.isPending}
          rejectLoading={rejectMutation.isPending}
          onApprove={() => approveMutation.mutate()}
          onReject={() => rejectMutation.mutate()}
          errorMessage={mutationError}
        />

        <OperationalChatCard
          sourceType="emergency"
          recordId={recordId}
          currentUserId={bootstrap.user.uid}
          locale={bootstrap.companyConfig.locale}
          timezone={bootstrap.companyConfig.timezone}
          photoPolicy={bootstrap.companyConfig.photoPolicy}
          allowInternalMessages
          placeholder="Escribe al tecnico o al cliente"
        />
      </ScrollView>
    );
  }

  const detailQuery = requestQuery;
  const approveMutation = requestApproveMutation;
  const rejectMutation = requestRejectMutation;

  if (detailQuery.isLoading) {
    return <LoadingScreen label="Cargando pago..." />;
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SectionCard
          title="No se pudo cargar el pago"
          subtitle={detailQuery.error instanceof Error ? detailQuery.error.message : 'Intenta de nuevo.'}
        />
      </ScrollView>
    );
  }

  const request = detailQuery.data;
  const isBusy = approveMutation.isPending || rejectMutation.isPending;
  const mutationError = approveMutation.error instanceof Error
    ? approveMutation.error.message
    : rejectMutation.error instanceof Error
      ? rejectMutation.error.message
      : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={detailQuery.isRefetching} onRefresh={() => void detailQuery.refetch()} />}
    >
      <SectionCard title="Revision de solicitud" subtitle={request.address || 'Sin direccion'}>
        <Text style={styles.eyebrow}>{formatQueueSourceType(sourceType)}</Text>
        <Text style={styles.status}>{formatRequestStatus(request.status)}</Text>
      </SectionCard>

      <RequestPaymentSummary
        request={request}
        currency={bootstrap.companyConfig.currency}
        locale={bootstrap.companyConfig.locale}
        timezone={bootstrap.companyConfig.timezone}
      />

      <DecisionCard
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        isBusy={isBusy}
        approveLoading={approveMutation.isPending}
        rejectLoading={rejectMutation.isPending}
        onApprove={() => approveMutation.mutate()}
        onReject={() => rejectMutation.mutate()}
        errorMessage={mutationError}
      />

      <OperationalChatCard
        sourceType="request"
        recordId={recordId}
        currentUserId={bootstrap.user.uid}
        locale={bootstrap.companyConfig.locale}
        timezone={bootstrap.companyConfig.timezone}
        photoPolicy={bootstrap.companyConfig.photoPolicy}
        allowInternalMessages
        placeholder="Escribe al tecnico o al cliente"
      />
    </ScrollView>
  );
}

function DecisionCard(props: {
  rejectionReason: string;
  setRejectionReason: (value: string) => void;
  isBusy: boolean;
  approveLoading: boolean;
  rejectLoading: boolean;
  onApprove: () => void;
  onReject: () => void;
  errorMessage: string | null;
}) {
  const { rejectionReason, setRejectionReason, isBusy, approveLoading, rejectLoading, onApprove, onReject, errorMessage } = props;

  return (
    <SectionCard title="Decision">
      <TextInput
        multiline
        numberOfLines={4}
        placeholder="Motivo de rechazo (opcional)"
        placeholderTextColor={colors.textPlaceholder}
        style={styles.input}
        value={rejectionReason}
        onChangeText={setRejectionReason}
      />
      <View style={styles.actions}>
        <AppButton loading={approveLoading} disabled={isBusy} onPress={onApprove}>
          Aprobar pago
        </AppButton>
        <AppButton tone="danger" loading={rejectLoading} disabled={isBusy} onPress={onReject}>
          Rechazar pago
        </AppButton>
      </View>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </SectionCard>
  );
}

function RequestPaymentSummary(props: {
  request: MarketplaceRequest;
  currency: string;
  locale: string;
  timezone: string;
}) {
  const { request, currency, locale, timezone } = props;

  return (
    <SectionCard title="Resumen de pago">
      <KeyValueList
        items={[
          { label: 'Cliente', value: request.clientNickname || request.clientEmail || 'Sin dato' },
          { label: 'Tecnico', value: request.employeeName || request.employeeEmail || 'Sin tecnico' },
          { label: 'Monto', value: formatCurrency(request.finalAmount, currency, locale) },
          { label: 'Subido', value: formatDateTime(request.paymentProofAt, locale, timezone) },
        ]}
      />
      {request.paymentProofUrl ? (
        <AppButton tone="secondary" onPress={() => void Linking.openURL(request.paymentProofUrl ?? '')}>
          Ver comprobante
        </AppButton>
      ) : null}
    </SectionCard>
  );
}

function EmergencyPaymentSummary(props: {
  call: MarketplaceEmergencyCall;
  currency: string;
  locale: string;
  timezone: string;
}) {
  const { call, currency, locale, timezone } = props;

  return (
    <SectionCard title="Resumen de pago">
      <KeyValueList
        items={[
          { label: 'Cliente', value: call.clientName || call.clientEmail || 'Sin dato' },
          { label: 'Tecnico', value: call.assignedEmployeeName || call.assignedEmployeeEmail || 'Sin tecnico' },
          { label: 'Monto', value: formatCurrency(call.finalAmount ?? call.quotedAmount, currency, locale) },
          { label: 'Subido', value: formatDateTime(call.paymentProofAt, locale, timezone) },
        ]}
      />
      {call.paymentProofUrl ? (
        <AppButton tone="secondary" onPress={() => void Linking.openURL(call.paymentProofUrl ?? '')}>
          Ver comprobante
        </AppButton>
      ) : null}
    </SectionCard>
  );
}

async function invalidatePaymentQueries(
  queryClient: QueryClient,
  sourceType: 'request' | 'emergency',
  recordId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['boss-review-queue'] }),
    queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
    queryClient.invalidateQueries({ queryKey: ['boss-payment-detail', sourceType, recordId] }),
    queryClient.invalidateQueries({ queryKey: ['boss-queue-detail', sourceType, recordId] }),
    queryClient.invalidateQueries({ queryKey: ['boss-requests'] }),
    queryClient.invalidateQueries({ queryKey: ['boss-emergency-calls'] }),
  ]);
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
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  status: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
  },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    color: colors.navy,
    textAlignVertical: 'top',
  },
  actions: {
    gap: spacing.md,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
});
