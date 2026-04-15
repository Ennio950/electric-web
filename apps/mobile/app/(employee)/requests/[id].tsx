import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { ChatComposer } from '@/src/components/ChatComposer';
import { ChatThread } from '@/src/components/ChatThread';
import { KeyValueList } from '@/src/components/KeyValueList';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { SectionCard } from '@/src/components/SectionCard';
import { compressImageForUpload, uploadImageAsset } from '@/src/lib/imageUpload';
import {
  claimRequest,
  fetchRequestChat,
  fetchRequestDetail,
  markRequestFinished,
  notifyBossRequestPayment,
  releaseRequest,
  sendRequestChatMessage,
  submitRequestPaymentProof,
  withCurrentToken,
} from '@/src/lib/api';
import { formatCurrency, formatDateTime, formatRequestStatus } from '@/src/lib/formatters';
import { captureImageFromCamera, pickImageFromLibrary } from '@/src/lib/media';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';

export default function EmployeeRequestDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const requestId = typeof params.id === 'string' ? params.id : '';
  const queryClient = useQueryClient();
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const [draftMessage, setDraftMessage] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [pendingChatAttachments, setPendingChatAttachments] = useState<string[]>([]);

  const detailQuery = useQuery({
    queryKey: ['request-detail', requestId],
    enabled: Boolean(requestId),
    queryFn: () => withCurrentToken((token) => fetchRequestDetail(token, requestId)),
  });

  const claimMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => claimRequest(token, requestId)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-available-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-my-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
        queryClient.invalidateQueries({ queryKey: ['request-detail', requestId] }),
      ]);
    },
  });

  const releaseMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => releaseRequest(token, requestId)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-available-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-my-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
        queryClient.invalidateQueries({ queryKey: ['request-detail', requestId] }),
      ]);
    },
  });

  const chatQuery = useQuery({
    queryKey: ['request-chat', requestId],
    enabled: Boolean(requestId),
    refetchInterval: 5_000,
    queryFn: () => withCurrentToken((token) => fetchRequestChat(token, requestId)),
  });

  const sendChatMutation = useMutation({
    mutationFn: async () => {
      const text = draftMessage.trim();
      if (!text && pendingChatAttachments.length === 0) {
        return null;
      }
      return withCurrentToken((token) => sendRequestChatMessage(token, requestId, text, pendingChatAttachments));
    },
    onSuccess: async () => {
      setDraftMessage('');
      setPendingChatAttachments([]);
      await queryClient.invalidateQueries({ queryKey: ['request-chat', requestId] });
    },
  });

  const uploadChatAttachmentMutation = useMutation({
    mutationFn: async (source: 'library' | 'camera') => {
      if (pendingChatAttachments.length >= 3) {
        throw new Error('Maximo 3 adjuntos por mensaje.');
      }

      const pickedImage = source === 'camera'
        ? await captureImageFromCamera()
        : await pickImageFromLibrary();

      if (!pickedImage) {
        return null;
      }

      const compressed = await compressImageForUpload(pickedImage, companyConfig.photoPolicy);
      return withCurrentToken(async (token) => {
        const upload = await uploadImageAsset({ token, asset: compressed });
        return upload.url;
      });
    },
    onSuccess: (uploadedUrl) => {
      if (!uploadedUrl) {
        return;
      }
      setPendingChatAttachments((current) => [...current, uploadedUrl].slice(0, 3));
    },
  });

  const submitProofMutation = useMutation({
    mutationFn: async () => {
      const nextProofUrl = proofUrl.trim();
      if (!nextProofUrl) {
        throw new Error('Pega la URL del comprobante antes de enviarlo.');
      }
      return withCurrentToken((token) => submitRequestPaymentProof(token, requestId, nextProofUrl));
    },
    onSuccess: async () => {
      setProofUrl('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['request-detail', requestId] }),
        queryClient.invalidateQueries({ queryKey: ['employee-my-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
      ]);
    },
  });

  const uploadProofMutation = useMutation({
    mutationFn: async (source: 'library' | 'camera') => {
      const pickedImage = source === 'camera'
        ? await captureImageFromCamera()
        : await pickImageFromLibrary();

      if (!pickedImage) {
        return null;
      }

      const compressed = await compressImageForUpload(pickedImage, companyConfig.photoPolicy);
      return withCurrentToken(async (token) => {
        const upload = await uploadImageAsset({ token, asset: compressed });
        return submitRequestPaymentProof(token, requestId, upload.url);
      });
    },
    onSuccess: async (result) => {
      if (!result) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['request-detail', requestId] }),
        queryClient.invalidateQueries({ queryKey: ['employee-my-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
      ]);
    },
  });

  const notifyBossMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => notifyBossRequestPayment(token, requestId)),
  });

  const finishMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => markRequestFinished(token, requestId)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['request-detail', requestId] }),
        queryClient.invalidateQueries({ queryKey: ['employee-my-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
      ]);
    },
  });

  if (!bootstrap || !requestId) {
    return <LoadingScreen label="Cargando request..." />;
  }

  if (detailQuery.isLoading) {
    return <LoadingScreen label="Cargando detalle..." />;
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SectionCard
          title="No se pudo cargar el request"
          subtitle={detailQuery.error instanceof Error ? detailQuery.error.message : 'Intenta refrescar de nuevo.'}
        />
      </ScrollView>
    );
  }

  const request = detailQuery.data;
  const companyConfig = bootstrap.companyConfig;
  const currentUserId = bootstrap.user.uid;
  const canClaim = request.status === 'EN_ESPERA';
  const canRelease = request.status === 'ASIGNADO' && request.assignedEmployeeId === currentUserId;
  const canFinish = request.status === 'EN_PROCESO' && request.assignedEmployeeId === currentUserId;
  const mutationMessage = claimMutation.error instanceof Error
    ? claimMutation.error.message
    : releaseMutation.error instanceof Error
      ? releaseMutation.error.message
      : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={detailQuery.isRefetching} onRefresh={() => void detailQuery.refetch()} />}
    >
      <SectionCard
        title={request.address || 'Request'}
        subtitle={request.description || 'Sin descripcion'}
      >
        <Text style={styles.status}>{formatRequestStatus(request.status)}</Text>
      </SectionCard>

      <SectionCard title="Resumen operativo">
        <KeyValueList
          items={[
            { label: 'Categoria', value: request.category || 'General' },
            { label: 'Tecnico', value: request.employeeName || request.employeeEmail || 'Sin asignar' },
            { label: 'Cliente', value: request.clientNickname || request.clientEmail || 'Sin dato' },
            { label: 'Creado', value: formatDateTime(request.createdAt, companyConfig.locale, companyConfig.timezone) },
            { label: 'Actualizado', value: formatDateTime(request.updatedAt, companyConfig.locale, companyConfig.timezone) },
            { label: 'Monto final', value: formatCurrency(request.finalAmount, companyConfig.currency, companyConfig.locale) },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Acciones disponibles"
        subtitle="Este detalle ya queda listo para la siguiente pasada de selfies y proof upload nativo."
      >
        <View style={styles.actions}>
          <AppButton
            loading={claimMutation.isPending}
            disabled={!canClaim || releaseMutation.isPending}
            onPress={() => claimMutation.mutate()}
          >
            Reclamar request
          </AppButton>
          <AppButton
            tone="secondary"
            loading={releaseMutation.isPending}
            disabled={!canRelease || claimMutation.isPending || finishMutation.isPending}
            onPress={() => releaseMutation.mutate()}
          >
            Soltar claim
          </AppButton>
          <AppButton
            tone="secondary"
            loading={finishMutation.isPending}
            disabled={!canFinish || claimMutation.isPending || releaseMutation.isPending}
            onPress={() => finishMutation.mutate()}
          >
            Marcar trabajo terminado
          </AppButton>
          {request.paymentProofUrl ? (
            <AppButton tone="secondary" onPress={() => void Linking.openURL(request.paymentProofUrl!)}>
              Ver comprobante
            </AppButton>
          ) : null}
        </View>
        {mutationMessage ? <Text style={styles.error}>{mutationMessage}</Text> : null}
        {finishMutation.error instanceof Error ? <Text style={styles.error}>{finishMutation.error.message}</Text> : null}
      </SectionCard>

      {request.paymentRejectionReason ? (
        <SectionCard title="Motivo de rechazo">
          <Text style={styles.body}>{request.paymentRejectionReason}</Text>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Comprobante de pago"
        subtitle="Ya puedes subir el comprobante desde galeria o camara. La URL manual queda como fallback."
      >
        <View style={styles.actions}>
          <AppButton
            tone="secondary"
            loading={uploadProofMutation.isPending}
            disabled={submitProofMutation.isPending || notifyBossMutation.isPending}
            onPress={() => uploadProofMutation.mutate('library')}
          >
            Subir desde galeria
          </AppButton>
          <AppButton
            tone="secondary"
            loading={uploadProofMutation.isPending}
            disabled={submitProofMutation.isPending || notifyBossMutation.isPending}
            onPress={() => uploadProofMutation.mutate('camera')}
          >
            Tomar foto
          </AppButton>
        </View>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://..."
          placeholderTextColor={colors.textPlaceholder}
          style={styles.input}
          value={proofUrl}
          onChangeText={setProofUrl}
        />
        <View style={styles.actions}>
          <AppButton
            loading={submitProofMutation.isPending}
            disabled={!proofUrl.trim() || notifyBossMutation.isPending}
            onPress={() => submitProofMutation.mutate()}
          >
            Enviar comprobante
          </AppButton>
          <AppButton
            tone="secondary"
            loading={notifyBossMutation.isPending}
            disabled={submitProofMutation.isPending}
            onPress={() => notifyBossMutation.mutate()}
          >
            Recordar al boss
          </AppButton>
        </View>
        {request.paymentProofUrl ? (
          <AppButton tone="secondary" onPress={() => void Linking.openURL(request.paymentProofUrl!)}>
            Ver comprobante actual
          </AppButton>
        ) : null}
        {uploadProofMutation.error instanceof Error ? <Text style={styles.error}>{uploadProofMutation.error.message}</Text> : null}
        {submitProofMutation.error instanceof Error ? <Text style={styles.error}>{submitProofMutation.error.message}</Text> : null}
        {notifyBossMutation.error instanceof Error ? <Text style={styles.error}>{notifyBossMutation.error.message}</Text> : null}
      </SectionCard>

      <SectionCard
        title="Chat operativo"
        subtitle="Polling simple para coordination v1. Los adjuntos entran en la siguiente pasada con el helper de upload."
      >
        {chatQuery.error ? (
          <Text style={styles.error}>
            {chatQuery.error instanceof Error ? chatQuery.error.message : 'No se pudo cargar el chat.'}
          </Text>
        ) : null}
        <ChatThread
          messages={chatQuery.data ?? []}
          currentUserId={currentUserId}
          locale={companyConfig.locale}
          timezone={companyConfig.timezone}
        />
        <View style={styles.actions}>
          <AppButton
            tone="secondary"
            loading={uploadChatAttachmentMutation.isPending}
            disabled={sendChatMutation.isPending || pendingChatAttachments.length >= 3}
            onPress={() => uploadChatAttachmentMutation.mutate('library')}
          >
            Adjuntar desde galeria
          </AppButton>
          <AppButton
            tone="secondary"
            loading={uploadChatAttachmentMutation.isPending}
            disabled={sendChatMutation.isPending || pendingChatAttachments.length >= 3}
            onPress={() => uploadChatAttachmentMutation.mutate('camera')}
          >
            Tomar foto para chat
          </AppButton>
        </View>
        {pendingChatAttachments.length ? (
          <View style={styles.attachmentDrafts}>
            {pendingChatAttachments.map((attachment, index) => (
              <View key={`${attachment}-${index}`} style={styles.attachmentDraft}>
                <Pressable accessibilityRole="link" accessibilityLabel={`Abrir adjunto ${index + 1}`} onPress={() => void Linking.openURL(attachment)}>
                  <Text style={styles.attachmentDraftLabel}>Adjunto {index + 1}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar adjunto ${index + 1}`}
                  onPress={() =>
                    setPendingChatAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  <Text style={styles.attachmentDraftRemove}>Quitar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <ChatComposer
          value={draftMessage}
          onChangeText={setDraftMessage}
          onSend={() => sendChatMutation.mutate()}
          isSending={sendChatMutation.isPending}
          disabled={chatQuery.isLoading}
          canSend={Boolean(draftMessage.trim()) || pendingChatAttachments.length > 0}
          placeholder="Escribe un mensaje para el cliente o boss"
        />
        {uploadChatAttachmentMutation.error instanceof Error ? <Text style={styles.error}>{uploadChatAttachmentMutation.error.message}</Text> : null}
        {sendChatMutation.error instanceof Error ? <Text style={styles.error}>{sendChatMutation.error.message}</Text> : null}
      </SectionCard>
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
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  actions: {
    gap: spacing.md,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.navy,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.navy,
  },
  attachmentDrafts: {
    gap: 10,
  },
  attachmentDraft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.md,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  attachmentDraftLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  attachmentDraftRemove: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.error,
  },
});
