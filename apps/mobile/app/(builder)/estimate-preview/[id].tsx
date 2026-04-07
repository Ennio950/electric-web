import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { calculateJob } from '@electric/estimator-core';

import { AppButton } from '@/src/components/AppButton';
import { SectionCard } from '@/src/components/SectionCard';
import { buildApiUrl } from '@/src/config/mobileEnv';
import { auth } from '@/src/config/firebase';
import { formatCurrency } from '@/src/lib/formatters';
import {
  builderEstimatePdfPath,
  createBuilderEstimate,
  fetchEmployeeRequests,
  linkBuilderEstimateToRequest,
  sendRequestProposal,
  withCurrentToken,
} from '@/src/lib/api';
import { useBuilderStore } from '@/src/stores/builderStore';
import { useSessionStore } from '@/src/stores/sessionStore';

export default function EstimatePreviewScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const jobId = Array.isArray(params.id) ? params.id[0] : params.id;

  const bootstrap = useSessionStore((state) => state.bootstrap);
  const jobs = useBuilderStore((state) => state.jobs);
  const materials = useBuilderStore((state) => state.materials);
  const recipes = useBuilderStore((state) => state.recipes);

  const job = jobs.find((j) => j.id === jobId) ?? null;
  const result = job ? calculateJob(job, materials, recipes) : null;

  const [savedEstimateId, setSavedEstimateId] = useState<string | null>(null);
  const [savedQuoteNumber, setSavedQuoteNumber] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isSendingProposal, setIsSendingProposal] = useState(false);
  const [proposalSentToRequestId, setProposalSentToRequestId] = useState<string | null>(null);

  if (!bootstrap || !job || !result) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Job no encontrado.</Text>
      </View>
    );
  }

  const currency = job.currency || bootstrap.companyConfig.currency;
  const locale = bootstrap.companyConfig.locale;

  async function handleSave() {
    if (!job || !result) return;
    setIsSaving(true);
    try {
      const saved = await withCurrentToken((token) =>
        createBuilderEstimate(token, {
          jobSnapshot: job as never,
          materials: materials as never,
          recipes: recipes as never,
          result: result as never,
        }),
      );
      setSavedEstimateId(saved.estimateId);
      setSavedQuoteNumber(saved.quoteNumber);
      Alert.alert('Estimacion guardada', `Numero de cotizacion: ${saved.quoteNumber}`);
    } catch (err) {
      Alert.alert(
        'No se pudo guardar',
        err instanceof Error ? err.message : 'Error al guardar la estimacion.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!savedEstimateId || !savedQuoteNumber) {
      Alert.alert('Primero guarda', 'Debes guardar la estimacion antes de generar el PDF.');
      return;
    }
    if (!FileSystem.documentDirectory) {
      Alert.alert('Error', 'No hay directorio disponible en este dispositivo.');
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autenticado.');
      const url = buildApiUrl(builderEstimatePdfPath(savedEstimateId));
      const localUri = `${FileSystem.documentDirectory}estimate_${savedQuoteNumber}.pdf`;

      const downloadResult = await FileSystem.downloadAsync(url, localUri, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (downloadResult.status !== 200) {
        throw new Error(`El servidor respondio con estado ${downloadResult.status}.`);
      }

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('PDF guardado', `Archivo guardado en: ${localUri}`);
        return;
      }

      await Sharing.shareAsync(localUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Cotizacion ${savedQuoteNumber}`,
      });
    } catch (err) {
      Alert.alert(
        'No se pudo generar el PDF',
        err instanceof Error ? err.message : 'Error al descargar el PDF.',
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  async function handleLinkToRequest() {
    if (!savedEstimateId) {
      Alert.alert('Primero guarda', 'Debes guardar la estimacion antes de vincularla.');
      return;
    }
    const estimateIdToLink = savedEstimateId;
    setIsLinking(true);
    try {
      const requests = await withCurrentToken((token) => fetchEmployeeRequests(token));
      // Filter only requests that can receive an estimate (pending/assigned states)
      const linkable = requests.filter(
        (r) => !['cancelled', 'closed', 'done'].includes(r.status ?? ''),
      );
      if (!linkable.length) {
        Alert.alert('Sin solicitudes', 'No hay solicitudes activas a las que vincular esta estimacion.');
        return;
      }

      Alert.alert(
        'Vincular a solicitud',
        'Selecciona la solicitud:\n\n' +
          linkable
            .slice(0, 5)
            .map((r, i) => `${i + 1}. ${r.category ?? 'Sin categoria'} - ${r.status}`)
            .join('\n'),
        [
          { text: 'Cancelar', style: 'cancel' },
          ...linkable.slice(0, 3).map((r, i) => ({
            text: `${i + 1}. ${(r.category ?? 'Sin cat').slice(0, 20)}`,
            onPress: () => {
              void (async () => {
                try {
                  await withCurrentToken((token) =>
                    linkBuilderEstimateToRequest(token, estimateIdToLink, r.id),
                  );
                  Alert.alert('Vinculada', 'La estimacion fue vinculada a la solicitud.');
                } catch (linkErr) {
                  Alert.alert(
                    'Error al vincular',
                    linkErr instanceof Error ? linkErr.message : 'Error desconocido.',
                  );
                }
              })();
            },
          })),
        ],
      );
    } catch (err) {
      Alert.alert(
        'No se pudieron cargar las solicitudes',
        err instanceof Error ? err.message : 'Error desconocido.',
      );
    } finally {
      setIsLinking(false);
    }
  }

  async function handleSendProposal() {
    if (!result) return;
    if (!savedEstimateId || !savedQuoteNumber) {
      Alert.alert('Primero guarda', 'Debes guardar la estimacion antes de enviar la propuesta.');
      return;
    }
    if (proposalSentToRequestId) {
      Alert.alert('Ya enviada', 'Esta estimacion ya fue enviada como propuesta.');
      return;
    }
    const estimateIdForProposal = savedEstimateId;
    const quoteNumberForProposal = savedQuoteNumber;
    setIsSendingProposal(true);
    try {
      const requests = await withCurrentToken((token) => fetchEmployeeRequests(token));
      const assignedRequests = requests.filter((r) => r.status === 'ASIGNADO');
      if (!assignedRequests.length) {
        Alert.alert(
          'Sin solicitudes asignadas',
          'No tienes solicitudes en estado ASIGNADO. Debes tener una solicitud asignada para enviar una propuesta.',
        );
        return;
      }

      const totals = result.totals;
      const proposalPayload = {
        amount: totals.grandTotal,
        quoteNumber: quoteNumberForProposal,
        breakdown: {
          materialTotal: totals.materialsSubtotal,
          serviceTotal: totals.laborSubtotal + totals.fixedCost,
          subtotal: totals.materialsSubtotal + totals.laborSubtotal + totals.fixedCost,
          taxRate: totals.taxPct,
          taxAmount: totals.taxAmount,
          total: totals.grandTotal,
        },
        estimatePdf: { estimateId: estimateIdForProposal },
      };

      Alert.alert(
        'Enviar propuesta',
        `Monto: ${formatCurrency(totals.grandTotal, currency, locale)}\nCotizacion: ${quoteNumberForProposal}\n\nSelecciona la solicitud:`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => setIsSendingProposal(false) },
          ...assignedRequests.slice(0, 4).map((r) => ({
            text: (r.category ?? r.description ?? r.id).slice(0, 30),
            onPress: () => {
              void (async () => {
                try {
                  await withCurrentToken((token) =>
                    sendRequestProposal(token, r.id, proposalPayload),
                  );
                  setProposalSentToRequestId(r.id);
                  Alert.alert(
                    'Propuesta enviada',
                    `La cotizacion ${quoteNumberForProposal} fue enviada al cliente. La solicitud paso a estado NEGOCIANDO.`,
                  );
                } catch (err) {
                  Alert.alert(
                    'Error al enviar propuesta',
                    err instanceof Error ? err.message : 'Error desconocido.',
                  );
                } finally {
                  setIsSendingProposal(false);
                }
              })();
            },
          })),
        ],
      );
    } catch (err) {
      Alert.alert(
        'No se pudieron cargar las solicitudes',
        err instanceof Error ? err.message : 'Error desconocido.',
      );
      setIsSendingProposal(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionCard title={job.name} subtitle={savedQuoteNumber ?? 'Sin numero de cotizacion'}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(result.totals.grandTotal, currency, locale)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.meta}>Materiales</Text>
          <Text style={styles.meta}>
            {formatCurrency(result.totals.materialsSubtotal, currency, locale)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.meta}>Labor</Text>
          <Text style={styles.meta}>
            {formatCurrency(result.totals.laborSubtotal, currency, locale)}
          </Text>
        </View>
        {result.totals.fixedCost > 0 && (
          <View style={styles.row}>
            <Text style={styles.meta}>Costo fijo</Text>
            <Text style={styles.meta}>
              {formatCurrency(result.totals.fixedCost, currency, locale)}
            </Text>
          </View>
        )}
        {result.totals.taxPct > 0 && (
          <View style={styles.row}>
            <Text style={styles.meta}>{`Impuesto (${result.totals.taxPct}%)`}</Text>
            <Text style={styles.meta}>
              {formatCurrency(result.totals.taxAmount, currency, locale)}
            </Text>
          </View>
        )}
      </SectionCard>

      {result.materials.length > 0 && (
        <SectionCard title="Materiales" subtitle={`${result.materials.length} items`}>
          {result.materials.map((line) => (
            <View key={line.materialId} style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.itemName}>{line.materialName}</Text>
                <Text style={styles.meta}>{`${line.qty} ${line.unit}`}</Text>
              </View>
              <Text style={styles.itemAmount}>
                {formatCurrency(line.subtotal, currency, locale)}
              </Text>
            </View>
          ))}
        </SectionCard>
      )}

      {result.componentBreakdown.length > 0 && (
        <SectionCard
          title="Breakdown"
          subtitle={`${result.componentBreakdown.length} componentes`}
        >
          {result.componentBreakdown.map((comp) => (
            <View key={comp.componentId} style={[styles.row, { paddingLeft: comp.depth * 12 }]}>
              <View style={styles.flex}>
                <Text style={styles.itemName}>{comp.name}</Text>
                <Text style={styles.meta}>{`${comp.baseQty} ${comp.baseUnit}`}</Text>
              </View>
              <Text style={styles.itemAmount}>
                {formatCurrency(comp.total, currency, locale)}
              </Text>
            </View>
          ))}
        </SectionCard>
      )}

      {result.errors.length > 0 && (
        <SectionCard title="Observaciones" subtitle={`${result.errors.length} avisos`}>
          {result.errors.map((error) => (
            <Text key={error} style={styles.errorText}>{`\u2022 ${error}`}</Text>
          ))}
        </SectionCard>
      )}

      <SectionCard title="Acciones" subtitle="Guardar, enviar propuesta, PDF o vincular.">
        <View style={styles.buttonStack}>
          <AppButton loading={isSaving} onPress={() => void handleSave()}>
            {savedEstimateId ? `Guardada: ${savedQuoteNumber ?? '...'}` : 'Guardar estimacion'}
          </AppButton>
          <AppButton
            loading={isSendingProposal}
            onPress={() => void handleSendProposal()}
          >
            {proposalSentToRequestId ? 'Propuesta enviada' : 'Enviar como propuesta'}
          </AppButton>
          <AppButton
            tone="secondary"
            loading={isDownloadingPdf}
            onPress={() => void handleDownloadPdf()}
          >
            Generar PDF
          </AppButton>
          <AppButton
            tone="secondary"
            loading={isLinking}
            onPress={() => void handleLinkToRequest()}
          >
            Vincular a solicitud
          </AppButton>
        </View>
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#4A5970',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 15,
    color: '#4A5970',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#10233F',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  flex: {
    flex: 1,
    marginRight: 8,
  },
  meta: {
    fontSize: 13,
    color: '#4A5970',
  },
  itemName: {
    fontSize: 14,
    color: '#10233F',
    fontWeight: '500',
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10233F',
  },
  errorText: {
    fontSize: 13,
    color: '#C0392B',
    marginBottom: 4,
  },
  buttonStack: {
    gap: 10,
  },
});
