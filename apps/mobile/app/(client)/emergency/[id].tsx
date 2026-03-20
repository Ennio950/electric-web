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
  closeClientEmergencyCall,
  fetchEmergencyDetail,
  updateEmergencyLocation,
  withCurrentToken,
} from '@/src/lib/api';
import { formatCurrency, formatDateTime, formatEmergencyStatus } from '@/src/lib/formatters';
import { compressImageForUpload, uploadImageAsset } from '@/src/lib/imageUpload';
import { getCurrentForegroundCoords } from '@/src/lib/location';
import { captureImageFromCamera, pickImageFromLibrary } from '@/src/lib/media';
import { useSessionStore } from '@/src/stores/sessionStore';

const CHAT_ENABLED_STATUSES = new Set([
  'accepted',
  'awaiting_client_close',
  'awaiting_payment_proof',
  'payment_pending_review',
]);

export default function ClientEmergencyDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const callId = typeof params.id === 'string' ? params.id : '';
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const queryClient = useQueryClient();
  const [finalAmount, setFinalAmount] = useState('');
  const [clientRating, setClientRating] = useState('5');
  const [finalPhotoUrl, setFinalPhotoUrl] = useState('');

  const detailQuery = useQuery({
    queryKey: ['client-emergency-detail', callId],
    enabled: Boolean(callId),
    queryFn: () => withCurrentToken((token) => fetchEmergencyDetail(token, callId)),
  });

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['client-emergency-calls'] }),
      queryClient.invalidateQueries({ queryKey: ['client-emergency-detail', callId] }),
      queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
    ]);
  }

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

      return withCurrentToken((token) => closeClientEmergencyCall(token, callId, {
        finalAmount: amount,
        clientRating: rating,
        finalPhotoUrl: finalPhotoUrl.trim() || undefined,
      }));
    },
    onSuccess: async () => {
      setFinalAmount('');
      setClientRating('5');
      setFinalPhotoUrl('');
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

  const locationMutation = useMutation({
    mutationFn: async () => {
      const coords = await getCurrentForegroundCoords();
      return withCurrentToken((token) => updateEmergencyLocation(token, callId, coords));
    },
    onSuccess: invalidateAll,
  });

  const status = String(detailQuery.data?.status || '').trim().toLowerCase();
  const canClose = status === 'awaiting_client_close';
  const showChat = CHAT_ENABLED_STATUSES.has(status);

  const actionError = useMemo(() => {
    const candidates = [closeMutation.error, uploadFinalPhotoMutation.error, locationMutation.error];
    const firstError = candidates.find((candidate) => candidate instanceof Error);
    return firstError instanceof Error ? firstError.message : null;
  }, [closeMutation.error, locationMutation.error, uploadFinalPhotoMutation.error]);

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
          subtitle={detailQuery.error instanceof Error ? detailQuery.error.message : 'Intenta refrescar de nuevo.'}
        />
      </ScrollView>
    );
  }

  const call = detailQuery.data;
  const companyConfig = bootstrap.companyConfig;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={detailQuery.isRefetching} onRefresh={() => void detailQuery.refetch()} />}
    >
      <SectionCard title={call.location || 'Emergencia'} subtitle={call.issue || 'Sin detalle'}>
        <Text style={styles.status}>{formatEmergencyStatus(call.status)}</Text>
      </SectionCard>

      <SectionCard title="Resumen">
        <KeyValueList
          items={[
            { label: 'Modo', value: call.dispatchMode || 'emergency' },
            { label: 'Prioridad', value: call.priority || 'urgent' },
            { label: 'Tecnico', value: call.assignedEmployeeName || call.assignedEmployeeEmail || 'Sin asignar' },
            { label: 'Telefono', value: call.phone || 'Sin telefono' },
            { label: 'Creado', value: formatDateTime(call.createdAt, companyConfig.locale, companyConfig.timezone) },
            { label: 'Monto', value: formatCurrency(call.finalAmount ?? call.quotedAmount, companyConfig.currency, companyConfig.locale) },
          ]}
        />
      </SectionCard>

      <SectionCard title="Acciones" subtitle="Comparte ubicacion y revisa evidencia del servicio.">
        <AppButton
          tone="secondary"
          loading={locationMutation.isPending}
          disabled={closeMutation.isPending}
          onPress={() => locationMutation.mutate()}
        >
          Compartir mi ubicacion
        </AppButton>
        {call.finalPhotoUrl ? (
          <AppButton tone="secondary" onPress={() => void Linking.openURL(call.finalPhotoUrl ?? '')}>
            Ver foto final actual
          </AppButton>
        ) : null}
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      </SectionCard>

      {canClose ? (
        <SectionCard
          title="Cerrar emergencia"
          subtitle="Confirma monto, calificacion y adjunta foto final si hace falta."
        >
          <TextInput
            keyboardType="decimal-pad"
            placeholder="Monto final"
            placeholderTextColor="#8A94A6"
            style={styles.input}
            value={finalAmount}
            onChangeText={setFinalAmount}
          />
          <TextInput
            keyboardType="number-pad"
            placeholder="Calificacion 1-5"
            placeholderTextColor="#8A94A6"
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
            placeholderTextColor="#8A94A6"
            style={styles.input}
            value={finalPhotoUrl}
            onChangeText={setFinalPhotoUrl}
          />
          <AppButton loading={closeMutation.isPending} onPress={() => closeMutation.mutate()}>
            Confirmar cierre
          </AppButton>
        </SectionCard>
      ) : null}

      {showChat ? (
        <OperationalChatCard
          sourceType="emergency"
          recordId={callId}
          currentUserId={bootstrap.user.uid}
          locale={companyConfig.locale}
          timezone={companyConfig.timezone}
          photoPolicy={companyConfig.photoPolicy}
          title="Chat de la emergencia"
          subtitle="Coordinacion directa con el tecnico desde movil."
          placeholder="Escribe al tecnico"
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
  status: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B5FFF',
  },
  actions: {
    gap: 12,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6DDE8',
    backgroundColor: '#F9FBFD',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#10233F',
  },
  error: {
    fontSize: 14,
    color: '#B42318',
  },
});
