import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { calculateJob } from '@electric/estimator-core';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { PressableCard } from '@/src/components/PressableCard';
import { SectionCard } from '@/src/components/SectionCard';
import {
  exportBuilderSnapshotToFile,
  pickBuilderSnapshotFile,
  shareBuilderSnapshotFile,
} from '@/src/lib/builderFiles';
import { formatCurrency } from '@/src/lib/formatters';
import { appRoutes, pushAppRoute } from '@/src/navigation/routes';
import { useBuilderStore, useCurrentBuilderJob } from '@/src/stores/builderStore';
import { useSessionStore } from '@/src/stores/sessionStore';

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
  const locale = bootstrap.companyConfig.locale;
  const latestJobs = jobs.slice(0, 3);

  const handleCreateEstimate = () => {
    const nextJob = createJob(`Estimado ${jobs.length + 1}`, bootstrap.companyConfig.currency);
    pushAppRoute(appRoutes.builderJobDetail(nextJob.id));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroGlowPrimary} />
        <View style={styles.heroGlowSecondary} />
        <Text style={styles.eyebrow}>Builder movil</Text>
        <Text style={styles.title}>Estimados y facturas listos para trabajar desde la app.</Text>
        <Text style={styles.subtitle}>
          Entra directo a un estimado nuevo, continua el ultimo o abre el historial sin perderte en menus tecnicos.
        </Text>

        <View style={styles.heroActionRow}>
          <View style={styles.heroActionPrimary}>
            <AppButton
              icon={<MaterialCommunityIcons color="#04111d" name="calculator-variant" size={18} />}
              onPress={handleCreateEstimate}
              size="lg"
            >
              Nuevo estimado
            </AppButton>
          </View>
          <View style={styles.heroActionSecondary}>
            <AppButton
              icon={<Ionicons color="#f8fbff" name="time-outline" size={18} />}
              onPress={() => pushAppRoute(appRoutes.builderEstimateHistory)}
              size="lg"
              tone="secondary"
            >
              Historial
            </AppButton>
          </View>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard
          icon={<MaterialCommunityIcons color="#f5c842" name="file-document-outline" size={18} />}
          label="Estimados"
          value={jobs.length}
        />
        <SummaryCard
          icon={<Ionicons color="#7dd3fc" name="cube-outline" size={18} />}
          label="Materiales"
          value={materials.length}
        />
        <SummaryCard
          icon={<Ionicons color="#c4b5fd" name="layers-outline" size={18} />}
          label="Recetas"
          value={recipes.length}
        />
        <SummaryCard
          icon={<Ionicons color="#6ee7b7" name="alert-circle-outline" size={18} />}
          label="Alertas"
          value={result?.errors.length ?? 0}
        />
      </View>

      <SectionCard title="Continuar trabajo" subtitle="Vuelve al estimado en curso o salta a la vista previa.">
        {currentJob ? (
          <View style={styles.currentEstimateCard}>
            <View style={styles.currentEstimateHeader}>
              <View style={styles.currentEstimateIcon}>
                <MaterialCommunityIcons color="#f5c842" name="calculator-variant-outline" size={20} />
              </View>
              <View style={styles.currentEstimateText}>
                <Text style={styles.currentEstimateTitle}>{currentJob.name}</Text>
                <Text style={styles.currentEstimateSubtitle}>
                  {result
                    ? `Total actual: ${formatCurrency(result.totals.grandTotal, currency, locale)}`
                    : 'Todavia no tiene calculo disponible.'}
                </Text>
              </View>
            </View>

            <View style={styles.inlineButtonRow}>
              <View style={styles.inlineButtonPrimary}>
                <AppButton
                  icon={<Ionicons color="#04111d" name="create-outline" size={18} />}
                  onPress={() => pushAppRoute(appRoutes.builderJobDetail(currentJob.id))}
                >
                  Editar
                </AppButton>
              </View>
              <View style={styles.inlineButtonSecondary}>
                <AppButton
                  icon={<Ionicons color="#f8fbff" name="eye-outline" size={18} />}
                  onPress={() => pushAppRoute(appRoutes.builderEstimatePreview(currentJob.id))}
                  tone="secondary"
                >
                  Vista previa
                </AppButton>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyBuilderState}>
            <Text style={styles.emptyBuilderTitle}>Todavia no hay un estimado activo.</Text>
            <Text style={styles.emptyBuilderSubtitle}>
              Crea uno nuevo y entra directo al editor con la base local del builder.
            </Text>
            <AppButton
              icon={<MaterialCommunityIcons color="#04111d" name="plus" size={18} />}
              onPress={handleCreateEstimate}
            >
              Crear primer estimado
            </AppButton>
          </View>
        )}
      </SectionCard>

      <SectionCard title="Acciones rapidas" subtitle="Lo importante primero, pensado para movil.">
        <View style={styles.quickGrid}>
          <QuickCard
            icon={<Ionicons color="#7dd3fc" name="document-text-outline" size={20} />}
            subtitle="Cotizaciones guardadas y PDFs listos para compartir."
            title="Estimados"
            onPress={() => pushAppRoute(appRoutes.builderEstimateHistory)}
          />
          <QuickCard
            icon={<Ionicons color="#6ee7b7" name="receipt-outline" size={20} />}
            subtitle="Genera una factura nueva desde el mismo modulo."
            title="Nueva factura"
            onPress={() => pushAppRoute(appRoutes.builderInvoiceNew)}
          />
          <QuickCard
            icon={<Ionicons color="#c4b5fd" name="cube-outline" size={20} />}
            subtitle="Precios, unidades y base de compra."
            title="Materiales"
            onPress={() => pushAppRoute(appRoutes.builderMaterials)}
          />
          <QuickCard
            icon={<Ionicons color="#f5c842" name="layers-outline" size={20} />}
            subtitle="Formulas y consumos reutilizables."
            title="Recetas"
            onPress={() => pushAppRoute(appRoutes.builderRecipes)}
          />
        </View>
      </SectionCard>

      <SectionCard title="Estimados recientes" subtitle="Tus ultimos trabajos guardados localmente.">
        <View style={styles.stack}>
          {latestJobs.map((job) => {
            const jobResult = calculateJob(job, materials, recipes);
            return (
              <PressableCard
                key={job.id}
                eyebrow="Estimado"
                meta={job.updatedAt}
                onPress={() => pushAppRoute(appRoutes.builderJobDetail(job.id))}
                subtitle={jobResult.ok ? 'Listo para revisar y exportar.' : 'Tiene observaciones por resolver.'}
                title={job.name}
              >
                <Text style={styles.jobAmount}>
                  {formatCurrency(jobResult.totals.grandTotal, job.currency, locale)}
                </Text>
              </PressableCard>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard title="Respaldo" subtitle="Exporta o importa el estado del builder cuando lo necesites.">
        <View style={styles.inlineButtonRow}>
          <View style={styles.inlineButtonPrimary}>
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
                      error instanceof Error ? error.message : 'No se pudo exportar el snapshot.',
                    );
                  } finally {
                    setIsExporting(false);
                  }
                })();
              }}
              tone="secondary"
            >
              Exportar archivo
            </AppButton>
          </View>
          <View style={styles.inlineButtonSecondary}>
            <AppButton
              loading={isImportingFile}
              onPress={() => {
                void (async () => {
                  try {
                    setIsImportingFile(true);
                    const payload = await pickBuilderSnapshotFile();
                    if (!payload) {
                      return;
                    }

                    const nextState = importSnapshot(payload);
                    if (!nextState.ok) {
                      Alert.alert('JSON invalido', nextState.message);
                      return;
                    }

                    Alert.alert('Builder importado', 'El archivo se aplico correctamente.');
                  } catch (error) {
                    Alert.alert(
                      'No se pudo importar',
                      error instanceof Error ? error.message : 'No se pudo importar el archivo.',
                    );
                  } finally {
                    setIsImportingFile(false);
                  }
                })();
              }}
              tone="secondary"
            >
              Importar archivo
            </AppButton>
          </View>
        </View>

        <TextInput
          value={importText}
          onChangeText={setImportText}
          placeholder="Pega aqui un snapshot JSON exportado del builder."
          multiline
          style={styles.importInput}
        />

        <View style={styles.inlineButtonRow}>
          <View style={styles.inlineButtonPrimary}>
            <AppButton
              onPress={() => {
                try {
                  const parsed = JSON.parse(importText);
                  const nextState = importSnapshot(parsed);
                  if (!nextState.ok) {
                    Alert.alert('JSON invalido', nextState.message);
                    return;
                  }
                  setImportText('');
                  Alert.alert('Builder importado', 'El snapshot JSON se aplico correctamente.');
                } catch (error) {
                  Alert.alert(
                    'JSON invalido',
                    error instanceof Error ? error.message : 'No se pudo importar el snapshot.',
                  );
                }
              }}
              tone="secondary"
            >
              Importar JSON
            </AppButton>
          </View>
          <View style={styles.inlineButtonSecondary}>
            <AppButton tone="danger" onPress={resetBuilder}>
              Reset base
            </AppButton>
          </View>
        </View>
      </SectionCard>
    </ScrollView>
  );
}

function SummaryCard(props: { icon: React.ReactNode; label: string; value: number }) {
  const { icon, label, value } = props;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryIconWrap}>{icon}</View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function QuickCard(props: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { icon, title, subtitle, onPress } = props;

  return (
    <View style={styles.quickCardWrap}>
      <PressableCard onPress={onPress} title={title} subtitle={subtitle}>
        <View style={styles.quickCardIcon}>{icon}</View>
      </PressableCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050816',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.16)',
    backgroundColor: '#071120',
    padding: 22,
    gap: 14,
  },
  heroGlowPrimary: {
    position: 'absolute',
    top: -40,
    right: -10,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: 'rgba(245,200,66,0.18)',
  },
  heroGlowSecondary: {
    position: 'absolute',
    bottom: -80,
    left: -40,
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: 'rgba(124,58,237,0.18)',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: '#f5c842',
  },
  title: {
    maxWidth: 300,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '900',
    color: '#f8fbff',
  },
  subtitle: {
    maxWidth: 320,
    fontSize: 15,
    lineHeight: 22,
    color: '#aac1d8',
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 6,
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
    gap: 12,
  },
  summaryCard: {
    minWidth: '47%',
    flexGrow: 1,
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
    backgroundColor: 'rgba(255,255,255,0.04)',
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
  currentEstimateCard: {
    gap: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245,200,66,0.16)',
    backgroundColor: 'rgba(11,18,36,0.92)',
    padding: 16,
  },
  currentEstimateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentEstimateIcon: {
    borderRadius: 16,
    backgroundColor: 'rgba(245,200,66,0.16)',
    padding: 12,
  },
  currentEstimateText: {
    flex: 1,
    gap: 4,
  },
  currentEstimateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fbff',
  },
  currentEstimateSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#9fb5cb',
  },
  emptyBuilderState: {
    gap: 12,
  },
  emptyBuilderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fbff',
  },
  emptyBuilderSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#9fb5cb',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickCardWrap: {
    width: '47%',
  },
  quickCardIcon: {
    marginTop: 2,
  },
  stack: {
    gap: 12,
  },
  jobAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fbff',
  },
  importInput: {
    minHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(11,18,36,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#f8fbff',
    textAlignVertical: 'top',
  },
  inlineButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineButtonPrimary: {
    flex: 1,
  },
  inlineButtonSecondary: {
    flex: 1,
  },
});
