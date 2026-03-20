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
  acceptEmergencyCall,
  fetchEmergencyChat,
  fetchEmergencyDetail,
  notifyBossEmergencyPayment,
  resolveEmergencyCall,
  sendEmergencyChatMessage,
  submitEmergencyPaymentProof,
  updateEmergencyLocation,
  withCurrentToken,
} from '@/src/lib/api';
import { formatCurrency, formatDateTime, formatEmergencyStatus } from '@/src/lib/formatters';
import { getCurrentForegroundCoords } from '@/src/lib/location';
import { captureImageFromCamera, pickImageFromLibrary } from '@/src/lib/media';
import { useSessionStore } from '@/src/stores/sessionStore';

export default function EmployeeEmergencyDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const callId = typeof params.id === 'string' ? params.id : '';
  const queryClient = useQueryClient();
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const [draftMessage, setDraftMessage] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [quotedAmount, setQuotedAmount] = useState('');
  const [pendingChatAttachments, setPendingChatAttachments] = useState<string[]>([]);

  const detailQuery = useQuery({
    queryKey: ['emergency-detail', callId],
    enabled: Boolean(callId),
    queryFn: () => withCurrentToken((token) => fetchEmergencyDetail(token, callId)),
  });

  const acceptMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => acceptEmergencyCall(token, callId)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-emergency-calls'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
        queryClient.invalidateQueries({ queryKey: ['emergency-detail', callId] }),
      ]);
    },
  });

  const chatQuery = useQuery({
    queryKey: ['emergency-chat', callId],
    enabled: Boolean(callId),
    refetchInterval: 5_000,
    queryFn: () => withCurrentToken((token) => fetchEmergencyChat(token, callId)),
  });

  const sendChatMutation = useMutation({
    mutationFn: async () => {
      const text = draftMessage.trim();
      if (!text && pendingChatAttachments.length === 0) {
        return null;
      }
      return withCurrentToken((token) => sendEmergencyChatMessage(token, callId, text, pendingChatAttachments));
    },
    onSuccess: async () => {
      setDraftMessage('');
      setPendingChatAttachments([]);
      await queryClient.invalidateQueries({ queryKey: ['emergency-chat', callId] });
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

  const shareLocationMutation = useMutation({
    mutationFn: async () => {
      const coords = await getCurrentForegroundCoords();
      return withCurrentToken((token) => updateEmergencyLocation(token, callId, coords));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['emergency-detail', callId] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
      ]);
    },
  });

  const submitProofMutation = useMutation({
    mutationFn: async () => {
      const nextProofUrl = proofUrl.trim();
      if (!nextProofUrl) {
        throw new Error('Pega la URL del comprobante antes de enviarlo.');
      }
      return withCurrentToken((token) => submitEmergencyPaymentProof(token, callId, nextProofUrl));
    },
    onSuccess: async () => {
      setProofUrl('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['emergency-detail', callId] }),
        queryClient.invalidateQueries({ queryKey: ['employee-emergency-calls'] }),
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
        return submitEmergencyPaymentProof(token, callId, upload.url);
      });
    },
    onSuccess: async (result) => {
      if (!result) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['emergency-detail', callId] }),
        queryClient.invalidateQueries({ queryKey: ['employee-emergency-calls'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
      ]);
    },
  });

  const notifyBossMutation = useMutation({
    mutationFn: () => withCurrentToken((token) => notifyBossEmergencyPayment(token, callId)),
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(quotedAmount.trim());
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('Ingresa un monto valido para cerrar la emergencia.');
      }
      return withCurrentToken((token) => resolveEmergencyCall(token, callId, amount));
    },
    onSuccess: async () => {
      setQuotedAmount('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['emergency-detail', callId] }),
        queryClient.invalidateQueries({ queryKey: ['employee-emergency-calls'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
      ]);
    },
  });

  if (!bootstrap || !callId) {
    return <LoadingScreen label="Cargando emergencia..." />;
  }

  if (detailQuery.isLoading) {
    return <LoadingScreen label="Cargando detalle..." />;
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SectionCard
          title="No se pudo cargar la emergencia"
          subtitle={detailQuery.error instanceof Error ? detailQuery.error.message : 'Intenta de nuevo.'}
        />
      </ScrollView>
    );
  }

  const call = detailQuery.data;
  const companyConfig = bootstrap.companyConfig;
  const currentUserId = bootstrap.user.uid;
  const canAccept = call.status === 'pending' || call.assignedEmployeeId === currentUserId;
  const canResolve = call.status === 'accepted' && call.assignedEmployeeId === currentUserId;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={detailQuery.isRefetching} onRefresh={() => void detailQuery.refetch()} />}
    >
      <SectionCard title={call.location || 'Emergencia'} subtitle={call.issue || 'Sin detalle'}>
        <Text style={styles.status}>{formatEmergencyStatus(call.status)}</Text>
      </SectionCard>

      <SectionCard title="Resumen operativo">
        <KeyValueList
          items={[
            { label: 'Prioridad', value: call.priority || 'urgent' },
            { label: 'Cliente', value: call.clientName || call.clientEmail || 'Sin dato' },
            { label: 'Telefono', value: call.phone || 'Sin telefono' },
            { label: 'Tecnico', value: call.assignedEmployeeName || call.assignedEmployeeEmail || 'Sin asignar' },
            { label: 'Creado', value: formatDateTime(call.createdAt, companyConfig.locale, companyConfig.timezone) },
            { label: 'Monto', value: formatCurrency(call.finalAmount ?? call.quotedAmount, companyConfig.currency, companyConfig.locale) },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Acciones"
        subtitle="Ya puedes compartir ubicacion real. Evidencia y cierre visual quedan para la siguiente pasada."
      >
        <View style={styles.actions}>
          <AppButton
            loading={acceptMutation.isPending}
            disabled={!canAccept || shareLocationMutation.isPending}
            onPress={() => acceptMutation.mutate()}
          >
            {call.status === 'pending' ? 'Aceptar emergencia' : 'Refrescar asignacion'}
          </AppButton>
          <AppButton
            tone="secondary"
            loading={shareLocationMutation.isPending}
            disabled={acceptMutation.isPending || resolveMutation.isPending}
            onPress={() => shareLocationMutation.mutate()}
          >
            Compartir ubicacion actual
          </AppButton>
          {call.paymentProofUrl ? (
            <AppButton tone="secondary" onPress={() => void Linking.openURL(call.paymentProofUrl!)}>
              Ver comprobante
            </AppButton>
          ) : null}
        </View>
        {acceptMutation.error instanceof Error ? <Text style={styles.error}>{acceptMutation.error.message}</Text> : null}
        {shareLocationMutation.error instanceof Error ? <Text style={styles.error}>{shareLocationMutation.error.message}</Text> : null}
      </SectionCard>

      <SectionCard
        title="Cerrar emergencia"
        subtitle="Cuando ya terminaste el trabajo, registra el monto para pasar a cierre del cliente."
      >
        <TextInput
          keyboardType="decimal-pad"
          placeholder={`Monto en ${companyConfig.currency}`}
          placeholderTextColor="#8A94A6"
          style={styles.input}
          value={quotedAmount}
          onChangeText={setQuotedAmount}
        />
        <AppButton
          loading={resolveMutation.isPending}
          disabled={!canResolve || acceptMutation.isPending || shareLocationMutation.isPending}
          onPress={() => resolveMutation.mutate()}
        >
          Resolver emergencia
        </AppButton>
        {resolveMutation.error instanceof Error ? <Text style={styles.error}>{resolveMutation.error.message}</Text> : null}
      </SectionCard>

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
          placeholderTextColor="#8A94A6"
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
        {call.paymentProofUrl ? (
          <AppButton tone="secondary" onPress={() => void Linking.openURL(call.paymentProofUrl!)}>
            Ver comprobante actual
          </AppButton>
        ) : null}
        {uploadProofMutation.error instanceof Error ? <Text style={styles.error}>{uploadProofMutation.error.message}</Text> : null}
        {submitProofMutation.error instanceof Error ? <Text style={styles.error}>{submitProofMutation.error.message}</Text> : null}
        {notifyBossMutation.error instanceof Error ? <Text style={styles.error}>{notifyBossMutation.error.message}</Text> : null}
      </SectionCard>

      <SectionCard title="Chat operativo" subtitle="Polling simple para staff v1. Los adjuntos entran con el helper de upload.">
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
                <Pressable onPress={() => void Linking.openURL(attachment)}>
                  <Text style={styles.attachmentDraftLabel}>Adjunto {index + 1}</Text>
                </Pressable>
                <Pressable
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
          placeholder="Coordina con el cliente o boss"
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
    backgroundColor: '#F4F7FB',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  status: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B5FFF',
  },
  actions: {
    gap: 12,
  },
  error: {
    fontSize: 14,
    color: '#B42318',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D8E2F0',
    borderRadius: 16,
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#10233F',
  },
  attachmentDrafts: {
    gap: 10,
  },
  attachmentDraft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  attachmentDraftLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B5FFF',
  },
  attachmentDraftRemove: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B42318',
  },
});
