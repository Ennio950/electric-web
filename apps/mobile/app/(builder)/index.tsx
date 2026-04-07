import { calculateJob } from '@electric/estimator-core';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { DashboardScreen } from '@/src/components/DashboardScreen';
import { PressableCard } from '@/src/components/PressableCard';
import { SectionCard } from '@/src/components/SectionCard';
import {
  exportBuilderSnapshotToFile,
  pickBuilderSnapshotFile,
  shareBuilderSnapshotFile
} from '@/src/lib/builderFiles';
import { useCurrentBuilderJob, useBuilderStore } from '@/src/stores/builderStore';
import { useSessionStore } from '@/src/stores/sessionStore';
import { formatCurrency } from '@/src/lib/formatters';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';

export default function BuilderDashboardScreen() {
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const jobs = useBuilderStore((state) => state.jobs);
  const materials = useBuilderStore((state) => state.materials);
  const recipes = useBuilderStore((state) => state.recipes);
  const createJob = useBuilderStore((state) => state.createJob);
  const resetBuilder = useBuilderStore((state) => state.resetBuilder);
  const exportSnapshot = useBuilderStore((state) => state.exportSnapshot);
  const importSnapshot = useBuilderStore((state) => state.importSnapshot);
  const currentJob = useCurrentBuilderJob();
  const [importText, setImportText] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImportingFile, setIsImportingFile] = useState(false);

  if (!bootstrap) {
    return null;
  }

  const result = currentJob ? calculateJob(currentJob, materials, recipes) : null;
  const currency = currentJob?.currency || bootstrap.companyConfig.currency;

  return (
    <DashboardScreen
      title="Estimator nativo"
      subtitle="Jobs, materiales, recetas y resultados corriendo con el mismo motor compartido del builder web."
      role="builder"
      companyName={bootstrap.companyConfig.companyName}
      stats={[
        { label: 'Jobs', value: jobs.length },
        { label: 'Materiales', value: materials.length },
        { label: 'Recetas', value: recipes.length },
        { label: 'Errores', value: result?.errors.length ?? 0 }
      ]}
      footer={(
        <View style={styles.sections}>
          <SectionCard title="Accesos" subtitle="Entra a catálogos o abre un trabajo para calcular.">
            <View style={styles.grid}>
              <PressableCard
                eyebrow="Catalogo"
                title="Materiales"
                subtitle="Precios, unidades y base de compra."
                onPress={() => pushAppRoute(appRoutes.builderMaterials)}
              />
              <PressableCard
                eyebrow="Catalogo"
                title="Recetas"
                subtitle="Parametros y salidas de consumo."
                onPress={() => pushAppRoute(appRoutes.builderRecipes)}
              />
              <PressableCard
                eyebrow="Historial"
                title="Estimaciones"
                subtitle="Cotizaciones guardadas con PDF."
                onPress={() => pushAppRoute(appRoutes.builderEstimateHistory)}
              />
              <PressableCard
                eyebrow="Facturacion"
                title="Nueva factura"
                subtitle="Crea y descarga facturas en PDF."
                onPress={() => pushAppRoute(appRoutes.builderInvoiceNew)}
              />
            </View>
          </SectionCard>

          <SectionCard title="Jobs" subtitle="Tu trabajo actual y los demás jobs guardados localmente.">
            <View style={styles.buttonRow}>
              <AppButton onPress={() => {
                const job = createJob(`Trabajo ${jobs.length + 1}`, bootstrap.companyConfig.currency);
                pushAppRoute(appRoutes.builderJobDetail(job.id));
              }}
              >
                Nuevo job
              </AppButton>
              <AppButton tone="secondary" onPress={resetBuilder}>
                Reset base
              </AppButton>
            </View>

            {currentJob ? (
              <PressableCard
                eyebrow="Actual"
                title={currentJob.name}
                subtitle={`Resultado: ${result?.ok ? 'listo' : 'con observaciones'}`}
                meta={result ? formatCurrency(result.totals.grandTotal, currency, bootstrap.companyConfig.locale) : 'Sin cálculo'}
                onPress={() => pushAppRoute(appRoutes.builderJobDetail(currentJob.id))}
              />
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.horizontalList}>
                {jobs.map((job) => (
                  <View key={job.id} style={styles.jobCardWrap}>
                    <PressableCard
                      eyebrow="Job"
                      title={job.name}
                      subtitle={`${job.rootComponent.children.length} subcomponentes`}
                      meta={job.updatedAt}
                      onPress={() => pushAppRoute(appRoutes.builderJobDetail(job.id))}
                    />
                  </View>
                ))}
              </View>
            </ScrollView>
          </SectionCard>

          {result ? (
            <SectionCard title="Totales rápidos" subtitle="Snapshot del job actual usando estimator-core.">
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(result.totals.grandTotal, currency, bootstrap.companyConfig.locale)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Materiales</Text>
                <Text style={styles.totalMeta}>
                  {formatCurrency(result.totals.materialsSubtotal, currency, bootstrap.companyConfig.locale)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Labor</Text>
                <Text style={styles.totalMeta}>
                  {formatCurrency(result.totals.laborSubtotal, currency, bootstrap.companyConfig.locale)}
                </Text>
              </View>
            </SectionCard>
          ) : null}

          <SectionCard title="Import / export" subtitle="Mueve el estado del builder en JSON o como archivo nativo.">
            <View style={styles.buttonRow}>
              <AppButton
                loading={isExporting}
                onPress={() => {
                  void (async () => {
                    try {
                      setIsExporting(true);
                      const uri = await exportBuilderSnapshotToFile(exportSnapshot());
                      await shareBuilderSnapshotFile(uri);
                    } catch (error) {
                      Alert.alert(
                        'No se pudo exportar',
                        error instanceof Error ? error.message : 'No se pudo exportar el snapshot.'
                      );
                    } finally {
                      setIsExporting(false);
                    }
                  })();
                }}
              >
                Exportar archivo
              </AppButton>
              <AppButton
                tone="secondary"
                loading={isImportingFile}
                onPress={() => {
                  void (async () => {
                    try {
                      setIsImportingFile(true);
                      const payload = await pickBuilderSnapshotFile();
                      if (!payload) {
                        return;
                      }

                      const result = importSnapshot(payload);
                      if (!result.ok) {
                        Alert.alert('JSON inválido', result.message);
                        return;
                      }

                      Alert.alert('Builder importado', 'El snapshot del archivo se aplicó correctamente.');
                    } catch (error) {
                      Alert.alert(
                        'No se pudo importar',
                        error instanceof Error ? error.message : 'No se pudo importar el archivo.'
                      );
                    } finally {
                      setIsImportingFile(false);
                    }
                  })();
                }}
              >
                Importar archivo
              </AppButton>
            </View>
            <TextInput
              value={importText}
              onChangeText={setImportText}
              placeholder="Pega aquí un snapshot JSON exportado del builder."
              multiline
              style={styles.importInput}
            />
            <AppButton
              tone="secondary"
              onPress={() => {
                try {
                  const parsed = JSON.parse(importText);
                  const result = importSnapshot(parsed);
                  if (!result.ok) {
                    Alert.alert('JSON inválido', result.message);
                    return;
                  }
                  setImportText('');
                  Alert.alert('Builder importado', 'El snapshot JSON se aplicó correctamente.');
                } catch (error) {
                  Alert.alert(
                    'JSON inválido',
                    error instanceof Error ? error.message : 'No se pudo importar el snapshot.'
                  );
                }
              }}
            >
              Importar JSON
            </AppButton>
          </SectionCard>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  sections: {
    gap: 16
  },
  grid: {
    gap: 12
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12
  },
  horizontalList: {
    flexDirection: 'row',
    gap: 12
  },
  jobCardWrap: {
    width: 240
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  totalLabel: {
    fontSize: 14,
    color: '#4A5970'
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10233F'
  },
  totalMeta: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10233F'
  },
  importInput: {
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7D5EA',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#10233F',
    textAlignVertical: 'top'
  }
});
