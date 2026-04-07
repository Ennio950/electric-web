import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { KeyValueList } from '@/src/components/KeyValueList';
import { SectionCard } from '@/src/components/SectionCard';
import { builderEstimatePdfPath, fetchBuilderEstimates, withCurrentToken } from '@/src/lib/api';
import { buildApiUrl } from '@/src/config/mobileEnv';
import { formatCurrency, formatDateTime } from '@/src/lib/formatters';
import { auth } from '@/src/config/firebase';
import { useSessionStore } from '@/src/stores/sessionStore';
import { useQuery } from '@tanstack/react-query';

export default function EstimateDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const estimateId = typeof params.id === 'string' ? params.id : '';
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const locale = bootstrap?.companyConfig.locale ?? 'es-GT';
  const timezone = bootstrap?.companyConfig.timezone ?? 'America/Guatemala';
  const [isDownloading, setIsDownloading] = useState(false);

  const query = useQuery({
    queryKey: ['builder-estimates'],
    queryFn: () => withCurrentToken(fetchBuilderEstimates),
  });

  const estimate = query.data?.find((e) => e.id === estimateId) ?? null;

  async function handleDownloadPdf() {
    setIsDownloading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        Alert.alert('Sin sesión', 'Vuelve a iniciar sesión.');
        return;
      }

      const apiPath = builderEstimatePdfPath(estimateId);
      const url = buildApiUrl(apiPath);
      const filename = `estimate_${estimate?.quoteNumber ?? estimateId}.pdf`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      const { status } = await FileSystem.downloadAsync(url, localUri, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (status !== 200) {
        Alert.alert('Error', 'No se pudo descargar el PDF.');
        return;
      }

      await Sharing.shareAsync(localUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Estimación ${estimate?.quoteNumber ?? ''}`,
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo descargar.');
    } finally {
      setIsDownloading(false);
    }
  }

  if (!estimate && !query.isLoading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SectionCard title="Estimación no encontrada">
          <Text style={styles.muted}>No se encontró la estimación con id: {estimateId}</Text>
        </SectionCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard
        title={estimate?.quoteNumber ?? '...'}
        subtitle={estimate?.jobName || estimate?.description || 'Estimación guardada'}
      >
        {estimate ? (
          <>
            <KeyValueList
              rows={[
                { label: 'Creada', value: formatDateTime(estimate.createdAt, locale, timezone) },
                { label: 'Por', value: estimate.createdByEmail ?? '—' },
                { label: 'Total', value: formatCurrency(estimate.grandTotal, estimate.currency, locale) },
                { label: 'Solicitud vinculada', value: estimate.requestId ?? 'Ninguna' },
              ]}
            />
          </>
        ) : null}
      </SectionCard>

      <SectionCard title="PDF">
        <AppButton loading={isDownloading} onPress={() => void handleDownloadPdf()}>
          Descargar / Compartir PDF
        </AppButton>
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 20, gap: 16 },
  muted: { fontSize: 14, color: '#6B778C' },
});
