import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { KeyValueList } from '@/src/components/KeyValueList';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { OperationalChatCard } from '@/src/components/OperationalChatCard';
import { SectionCard } from '@/src/components/SectionCard';
import {
  acceptRequestProposal,
  cancelClientRequest,
  closeClientRequest,
  fetchEstimateUrl,
  fetchRequestDetail,
  rejectRequestProposal,
  submitRequestPaymentProof,
  withCurrentToken,
} from '@/src/lib/api';
import { formatCurrency, formatDateTime, formatRequestStatus } from '@/src/lib/formatters';
import { compressImageForUpload, uploadImageAsset } from '@/src/lib/imageUpload';
import { captureImageFromCamera, pickImageFromLibrary } from '@/src/lib/media';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';

const CHAT_ENABLED_STATUSES = new Set([
  'ASIGNADO',
  'NEGOCIANDO',
  'EN_PROCESO',
  'ESPERANDO_CIERRE_CLIENTE',
]);

export default function ClientRequestDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const requestId = typeof params.id === 'string' ? params.id : '';
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const queryClient = useQueryClient();
  const [finalAmount, setFinalAmount] = useState('');
  const [clientRating, setClientRating] = useState('5');
  const [finalPhotoUrl, setFinalPhotoUrl] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');

  const detailQuery = useQuery({
    queryKey: ['client-request-detail', requestId],
    enabled: Boolean(requestId),
    queryFn: () => withCurrentToken((token) => fetchRequestDetail(token, requestId)),
  });

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['client-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
      queryClient.invalidateQueries({ queryKey: ['client-request-detail', requestId] }),
    ]);
  }

  const cancelMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => cancelClientRequest(token, requestId)),
    onSuccess: invalidateAll,
  });

  const acceptProposalMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => acceptRequestProposal(token, requestId)),
    onSuccess: invalidateAll,
  });

  const rejectProposalMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => rejectRequestProposal(token, requestId)),
    onSuccess: invalidateAll,
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(finalAmount);
      const rating = Number(clientRating);

      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('Ingresa un monto final valido.');
      }

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error('La calificacion debe ser de 1 a 5.');
      }

      return withCurrentToken((token) =>
        closeClientRequest(token, requestId, {
          finalAmount: amount,
          clientRating: rating,
          finalPhotoUrl: finalPhotoUrl.trim() || undefined,
        }),
      );
    },
    onSuccess: async () => {
      setFinalAmount('');
      setClientRating('5');
      setFinalPhotoUrl('');
      await invalidateAll();
    },
  });

  const submitProofMutation = useMutation({
    mutationFn: async () => {
      const proofUrl = paymentProofUrl.trim();
      if (!proofUrl) {
        throw new Error('Sube o pega el comprobante antes de enviarlo.');
      }
      return withCurrentToken((token) => submitRequestPaymentProof(token, requestId, proofUrl));
    },
    onSuccess: async () => {
      setPaymentProofUrl('');
      await invalidateAll();
    },
  });

  const uploadFinalPhotoMutation = useMutation({
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
        setFinalPhotoUrl(uploadedUrl);
      }
    },
  });

  const uploadProofMutation = useMutation({
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
        return submitRequestPaymentProof(token, requestId, uploaded.url);
      });
    },
    onSuccess: async () => {
      await invalidateAll();
    },
  });

  const estimateMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => fetchEstimateUrl(token, requestId)),
    onSuccess: async (result) => {
      if (result?.url) {
        await Linking.openURL(result.url);
      }
    },
  });

  const status = String(detailQuery.data?.status || '').trim().toUpperCase();
  const canCancel = status === 'EN_ESPERA';
  const canAcceptProposal = status === 'NEGOCIANDO';
  const canClose = status === 'ESPERANDO_CIERRE_CLIENTE';
  const canSubmitProof = status === 'ESPERANDO_COMPROBANTE_PAGO';
  const showChat = CHAT_ENABLED_STATUSES.has(status);

  const actionError = useMemo(() => {
    const candidates = [
      cancelMutation.error,
      acceptProposalMutation.error,
      rejectProposalMutation.error,
      closeMutation.error,
      submitProofMutation.error,
      uploadFinalPhotoMutation.error,
      uploadProofMutation.error,
      estimateMutation.error,
    ];

    const firstError = candidates.find((candidate) => candidate instanceof Error);
    return firstError instanceof Error ? firstError.message : null;
  }, [
    acceptProposalMutation.error,
    cancelMutation.error,
    closeMutation.error,
    estimateMutation.error,
    rejectProposalMutation.error,
    submitProofMutation.error,
    uploadFinalPhotoMutation.error,
    uploadProofMutation.error,
  ]);

  if (!bootstrap || !requestId) {
    return <LoadingScreen label="Cargando solicitud..." />;
  }

  if (detailQuery.isLoading) {
    return <LoadingScreen label="Cargando detalle..." />;
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SectionCard
          title="No se pudo cargar la solicitud"
          subtitle={detailQuery.error instanceof Error ? detailQuery.error.message : 'Intenta refrescar de nuevo.'}
        />
      </ScrollView>
    );
  }

  const request = detailQuery.data;
  const companyConfig = bootstrap.companyConfig;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={detailQuery.isRefetching} onRefresh={() => void detailQuery.refetch()} />}
    >
      <SectionCard
        title={request.address || 'Solicitud'}
        subtitle={request.description || 'Sin descripcion'}
      >
        <Text style={styles.status}>{formatRequestStatus(request.status)}</Text>
      </SectionCard>

      <SectionCard title="Resumen">
        <KeyValueList
          items={[
            { label: 'Categoria', value: request.category || 'General' },
            { label: 'Tecnico', value: request.employeeName || request.employeeEmail || 'Sin asignar' },
            { label: 'Monto final', value: formatCurrency(request.finalAmount, companyConfig.currency, companyConfig.locale) },
            { label: 'Creada', value: formatDateTime(request.createdAt, companyConfig.locale, companyConfig.timezone) },
            { label: 'Actualizada', value: formatDateTime(request.updatedAt, companyConfig.locale, companyConfig.timezone) },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Acciones"
        subtitle="Aqui entra la parte cliente de aprobacion, cierre y comprobantes."
      >
        <View style={styles.actions}>
          <AppButton
            tone="danger"
            loading={cancelMutation.isPending}
            disabled={!canCancel}
            onPress={() => cancelMutation.mutate()}
          >
            Cancelar solicitud
          </AppButton>
          <AppButton
            loading={acceptProposalMutation.isPending}
            disabled={!canAcceptProposal || rejectProposalMutation.isPending}
            onPress={() => acceptProposalMutation.mutate()}
          >
            Aceptar propuesta
          </AppButton>
          <AppButton
            tone="secondary"
            loading={rejectProposalMutation.isPending}
            disabled={!canAcceptProposal || acceptProposalMutation.isPending}
            onPress={() => rejectProposalMutation.mutate()}
          >
            Rechazar propuesta
          </AppButton>
          <AppButton
            tone="secondary"
            loading={estimateMutation.isPending}
            disabled={acceptProposalMutation.isPending || rejectProposalMutation.isPending}
            onPress={() => estimateMutation.mutate()}
          >
            Ver estimate PDF
          </AppButton>
        </View>
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      </SectionCard>

      {canClose ? (
        <SectionCard
          title="Cerrar trabajo"
          subtitle="Confirma cuanto pagaste, deja tu calificacion y sube una foto final si quieres."
        >
          <TextInput
            keyboardType="decimal-pad"
            placeholder="Monto final"
            placeholderTextColor={colors.textPlaceholder}
            style={styles.input}
            value={finalAmount}
            onChangeText={setFinalAmount}
          />
          <TextInput
            keyboardType="number-pad"
            placeholder="Calificacion 1-5"
            placeholderTextColor={colors.textPlaceholder}
            style={styles.input}
            value={clientRating}
            onChangeText={setClientRating}
          />
          <View style={styles.actions}>
            <AppButton
              tone="secondary"
              loading={uploadFinalPhotoMutation.isPending}
              disabled={closeMutation.isPending}
              onPress={() => uploadFinalPhotoMutation.mutate('library')}
            >
              Foto final desde galeria
            </AppButton>
            <AppButton
              tone="secondary"
              loading={uploadFinalPhotoMutation.isPending}
              disabled={closeMutation.isPending}
              onPress={() => uploadFinalPhotoMutation.mutate('camera')}
            >
              Tomar foto final
            </AppButton>
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://... (foto final)"
            placeholderTextColor={colors.textPlaceholder}
            style={styles.input}
            value={finalPhotoUrl}
            onChangeText={setFinalPhotoUrl}
          />
          <AppButton loading={closeMutation.isPending} onPress={() => closeMutation.mutate()}>
            Confirmar cierre
          </AppButton>
          {request.finalPhotoUrl ? (
            <AppButton tone="secondary" onPress={() => void Linking.openURL(request.finalPhotoUrl!)}>
              Ver foto final actual
            </AppButton>
          ) : null}
        </SectionCard>
      ) : null}

      {canSubmitProof ? (
        <SectionCard
          title="Comprobante de pago"
          subtitle="Sube el comprobante para pasar la solicitud a revision del boss."
        >
          <View style={styles.actions}>
            <AppButton
              tone="secondary"
              loading={uploadProofMutation.isPending}
              disabled={submitProofMutation.isPending}
              onPress={() => uploadProofMutation.mutate('library')}
            >
              Comprobante desde galeria
            </AppButton>
            <AppButton
              tone="secondary"
              loading={uploadProofMutation.isPending}
              disabled={submitProofMutation.isPending}
              onPress={() => uploadProofMutation.mutate('camera')}
            >
              Tomar foto de comprobante
            </AppButton>
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://... (fallback manual)"
            placeholderTextColor={colors.textPlaceholder}
            style={styles.input}
            value={paymentProofUrl}
            onChangeText={setPaymentProofUrl}
          />
          <AppButton
            loading={submitProofMutation.isPending}
            disabled={!paymentProofUrl.trim() || uploadProofMutation.isPending}
            onPress={() => submitProofMutation.mutate()}
          >
            Enviar comprobante
          </AppButton>
          {request.paymentProofUrl ? (
            <AppButton tone="secondary" onPress={() => void Linking.openURL(request.paymentProofUrl!)}>
              Ver comprobante actual
            </AppButton>
          ) : null}
        </SectionCard>
      ) : null}

      {request.photoUrl ? (
        <SectionCard title="Foto inicial">
          <AppButton tone="secondary" onPress={() => void Linking.openURL(request.photoUrl!)}>
            Ver foto enviada al crear la solicitud
          </AppButton>
        </SectionCard>
      ) : null}

      {showChat ? (
        <OperationalChatCard
          sourceType="request"
          recordId={requestId}
          currentUserId={bootstrap.user.uid}
          locale={companyConfig.locale}
          timezone={companyConfig.timezone}
          photoPolicy={companyConfig.photoPolicy}
          title="Chat del servicio"
          subtitle="Canal cliente-tecnico con adjuntos reales."
          placeholder="Escribe al tecnico"
        />
      ) : null}
    </ScrollView>
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
  status: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  actions: {
    gap: spacing.md,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.navy,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
});
