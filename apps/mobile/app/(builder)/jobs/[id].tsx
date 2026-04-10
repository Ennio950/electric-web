import { Ionicons } from '@expo/vector-icons';
import { calculateJob, componentDerivedSchema, type MeasureType, type QuoteComponent } from '@electric/estimator-core';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { PressableCard } from '@/src/components/PressableCard';
import { SectionCard } from '@/src/components/SectionCard';
import { formatCurrency } from '@/src/lib/formatters';
import { appRoutes, pushAppRoute, replaceAppRoute } from '@/src/navigation/routes';
import { useBuilderStore, useCurrentBuilderJob, useSelectedBuilderComponent } from '@/src/stores/builderStore';
import { useSessionStore } from '@/src/stores/sessionStore';
import { colors, radii, spacing } from '@/src/theme';

const MEASURE_TYPES: MeasureType[] = ['AREA', 'VOLUME', 'LENGTH', 'COUNT', 'ASSEMBLY', 'TIME', 'CUSTOM_FORMULA'];
const LABOR_MODES = ['NONE', 'PER_COMPONENT', 'PER_BASE_UNIT', 'PER_HOUR'] as const;
const MEASURE_LABELS: Record<MeasureType, string> = {
  AREA: 'Area',
  VOLUME: 'Volumen',
  LENGTH: 'Longitud',
  COUNT: 'Cantidad',
  ASSEMBLY: 'Ensamble',
  TIME: 'Tiempo',
  CUSTOM_FORMULA: 'Formula',
};
const LABOR_LABELS: Record<(typeof LABOR_MODES)[number], string> = {
  NONE: 'Sin labor',
  PER_COMPONENT: 'Por componente',
  PER_BASE_UNIT: 'Por unidad',
  PER_HOUR: 'Por hora',
};

export default function BuilderJobDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const jobId = Array.isArray(params.id) ? params.id[0] : params.id;
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const jobs = useBuilderStore((state) => state.jobs);
  const materials = useBuilderStore((state) => state.materials);
  const recipes = useBuilderStore((state) => state.recipes);
  const currentJobId = useBuilderStore((state) => state.currentJobId);
  const selectedComponentId = useBuilderStore((state) => state.selectedComponentId);
  const setCurrentJobId = useBuilderStore((state) => state.setCurrentJobId);
  const setSelectedComponentId = useBuilderStore((state) => state.setSelectedComponentId);
  const updateCurrentJobMeta = useBuilderStore((state) => state.updateCurrentJobMeta);
  const deleteJob = useBuilderStore((state) => state.deleteJob);
  const addComponent = useBuilderStore((state) => state.addComponent);
  const removeComponent = useBuilderStore((state) => state.removeComponent);
  const updateComponentName = useBuilderStore((state) => state.updateComponentName);
  const updateComponentMeasureType = useBuilderStore((state) => state.updateComponentMeasureType);
  const updateComponentInputValue = useBuilderStore((state) => state.updateComponentInputValue);
  const updateComponentBaseMeasure = useBuilderStore((state) => state.updateComponentBaseMeasure);
  const updateComponentLabor = useBuilderStore((state) => state.updateComponentLabor);
  const updateComponentWastePct = useBuilderStore((state) => state.updateComponentWastePct);
  const updateComponentDerived = useBuilderStore((state) => state.updateComponentDerived);
  const bindRecipe = useBuilderStore((state) => state.bindRecipe);
  const unbindRecipe = useBuilderStore((state) => state.unbindRecipe);
  const updateRecipeParamOverride = useBuilderStore((state) => state.updateRecipeParamOverride);
  const [derivedJson, setDerivedJson] = useState('[]');
  const [derivedError, setDerivedError] = useState<string | null>(null);

  const job = useCurrentBuilderJob();
  const selectedComponent = useSelectedBuilderComponent();

  useEffect(() => {
    if (jobId && currentJobId !== jobId) {
      setCurrentJobId(jobId);
    }
  }, [currentJobId, jobId, setCurrentJobId]);

  useEffect(() => {
    setDerivedJson(JSON.stringify(selectedComponent?.derived ?? [], null, 2));
    setDerivedError(null);
  }, [selectedComponent?.id, selectedComponent?.derived]);

  useEffect(() => {
    if (job && (!selectedComponentId || !containsComponent(job.rootComponent, selectedComponentId))) {
      setSelectedComponentId(job.rootComponent.id);
    }
  }, [job, selectedComponentId, setSelectedComponentId]);

  const currentJob = useMemo(() => jobs.find((entry) => entry.id === jobId) ?? null, [jobId, jobs]);
  const result = job ? calculateJob(job, materials, recipes) : null;

  if (!bootstrap) {
    return null;
  }

  if (!currentJob || !job) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Este estimado ya no existe.</Text>
        <AppButton onPress={() => replaceAppRoute(appRoutes.builderHome)}>Volver al builder</AppButton>
      </View>
    );
  }

  const boundRecipeIds = new Set(selectedComponent?.recipeBindings.map((binding) => binding.recipeId) ?? []);
  const availableRecipes = recipes.filter((recipe) => !boundRecipeIds.has(recipe.id));
  const locale = bootstrap.companyConfig.locale;
  const componentCount = countComponents(job.rootComponent);
  const total = result ? formatCurrency(result.totals.grandTotal, job.currency, locale) : 'Sin calculo';
  const targetComponentId = selectedComponent?.id ?? job.rootComponent.id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Editor movil</Text>
        <Text style={styles.heroTitle}>{job.name}</Text>
        <Text style={styles.heroSubtitle}>Ahora el estimador entra directo al flujo de app: total arriba, acciones claras y bloque activo seleccionado.</Text>
        <View style={styles.statsRow}>
          <MiniStat label="Total" value={total} />
          <MiniStat label="Bloques" value={String(componentCount)} />
          <MiniStat label="Alertas" value={String(result?.errors.length ?? 0)} />
        </View>
        <View style={styles.heroButtons}>
          <View style={styles.flex}>
            <AppButton icon={<Ionicons color="#04111d" name="eye-outline" size={18} />} onPress={() => pushAppRoute(appRoutes.builderEstimatePreview(job.id))} size="lg">
              Vista previa
            </AppButton>
          </View>
          <View style={styles.flex}>
            <AppButton icon={<Ionicons color={colors.textPrimary} name="add-outline" size={18} />} onPress={() => addComponent(targetComponentId, 'AREA')} size="lg" tone="secondary">
              Agregar area
            </AppButton>
          </View>
        </View>
      </View>

      <SectionCard title="Resumen del estimado" subtitle="Datos base listos para editar sin tabla compacta.">
        <Field label="Nombre del estimado" value={job.name} onChangeText={(name) => updateCurrentJobMeta({ name })} />
        <Field label="Moneda" value={job.currency} onChangeText={(currency) => updateCurrentJobMeta({ currency })} />
        <Field label="Waste global %" value={String(job.globalWastePct)} keyboardType="numeric" onChangeText={(raw) => updateCurrentJobMeta({ globalWastePct: Number(raw) || 0 })} />
        <Field label="Costo fijo" value={String(job.fixedCost)} keyboardType="numeric" onChangeText={(raw) => updateCurrentJobMeta({ fixedCost: Number(raw) || 0 })} />
        <Field label="Impuesto %" value={String(job.tax.pct)} keyboardType="numeric" onChangeText={(raw) => updateCurrentJobMeta({ tax: { ...job.tax, pct: Number(raw) || 0 } })} />
        <AppButton tone="danger" onPress={() => { deleteJob(job.id); replaceAppRoute(appRoutes.builderHome); }}>Eliminar estimado</AppButton>
      </SectionCard>

      <SectionCard title="Arbol de bloques" subtitle="Toca un bloque para editarlo y agrega hijos desde el actual.">
        <View style={styles.chipRow}>
          {MEASURE_TYPES.slice(0, 4).map((entry) => (
            <Pressable key={entry} onPress={() => addComponent(targetComponentId, entry)} style={({ pressed }) => [styles.quickChip, pressed ? styles.quickChipPressed : null]}>
              <Text style={styles.quickChipText}>{MEASURE_LABELS[entry]}</Text>
            </Pressable>
          ))}
        </View>
        <ComponentNode component={job.rootComponent} onSelect={setSelectedComponentId} selectedId={selectedComponentId} />
      </SectionCard>

      {selectedComponent ? (
        <SectionCard title="Bloque activo" subtitle="Edicion del nodo seleccionado con acciones pensadas para movil.">
          <View style={styles.activeCard}>
            <Text style={styles.activeTitle}>{selectedComponent.name}</Text>
            <Text style={styles.activeMeta}>{MEASURE_LABELS[selectedComponent.measureType]} · {selectedComponent.children.length} hijos · {selectedComponent.recipeBindings.length} recetas</Text>
          </View>
          <Field label="Nombre del bloque" value={selectedComponent.name} onChangeText={(name) => updateComponentName(selectedComponent.id, name)} />
          <Text style={styles.helperTitle}>Tipo de medida</Text>
          <View style={styles.chipRow}>
            {MEASURE_TYPES.map((measureType) => (
              <Pressable key={measureType} onPress={() => updateComponentMeasureType(selectedComponent.id, measureType)} style={[styles.measureChip, selectedComponent.measureType === measureType ? styles.measureChipActive : null]}>
                <Text style={[styles.measureChipText, selectedComponent.measureType === measureType ? styles.measureChipTextActive : null]}>{MEASURE_LABELS[measureType]}</Text>
              </Pressable>
            ))}
          </View>
          {selectedComponent.inputs.length ? selectedComponent.inputs.map((input) => (
            <Field key={input.id} label={`${input.label} (${input.unit})`} value={String(selectedComponent.inputValues[input.id] ?? '')} keyboardType="numeric" onChangeText={(raw) => updateComponentInputValue(selectedComponent.id, input.id, Number(raw) || 0)} />
          )) : <Text style={styles.muted}>Este bloque no necesita inputs manuales.</Text>}
          <Field label="Unidad base" value={selectedComponent.baseMeasure.unit} onChangeText={(unit) => updateComponentBaseMeasure(selectedComponent.id, { unit })} />
          <Field label="Waste %" value={String(selectedComponent.wastePct)} keyboardType="numeric" onChangeText={(raw) => updateComponentWastePct(selectedComponent.id, Number(raw) || 0)} />
          <Field label="Formula base" value={selectedComponent.baseMeasure.expr} multiline onChangeText={(expr) => updateComponentBaseMeasure(selectedComponent.id, { expr })} />
          <Text style={styles.helperTitle}>Labor</Text>
          <View style={styles.chipRow}>
            {LABOR_MODES.map((mode) => (
              <Pressable key={mode} onPress={() => updateComponentLabor(selectedComponent.id, { mode })} style={[styles.measureChip, selectedComponent.labor.mode === mode ? styles.measureChipActive : null]}>
                <Text style={[styles.measureChipText, selectedComponent.labor.mode === mode ? styles.measureChipTextActive : null]}>{LABOR_LABELS[mode]}</Text>
              </Pressable>
            ))}
          </View>
          {selectedComponent.labor.mode !== 'NONE' ? (
            <>
              <Field label="Tarifa de labor" value={String(selectedComponent.labor.rate)} keyboardType="numeric" onChangeText={(raw) => updateComponentLabor(selectedComponent.id, { rate: Number(raw) || 0 })} />
              <Field label="Horas" value={String(selectedComponent.labor.hours)} keyboardType="numeric" onChangeText={(raw) => updateComponentLabor(selectedComponent.id, { hours: Number(raw) || 0 })} />
            </>
          ) : null}
          <Field label="JSON derivado" value={derivedJson} multiline onChangeText={setDerivedJson} />
          {derivedError ? <Text style={styles.errorText}>{derivedError}</Text> : null}
          <AppButton tone="secondary" onPress={() => {
            try {
              const parsed = JSON.parse(derivedJson);
              const validated = componentDerivedSchema.array().safeParse(parsed);
              if (!validated.success) {
                setDerivedError(validated.error.message);
                return;
              }
              updateComponentDerived(selectedComponent.id, validated.data);
              setDerivedError(null);
            } catch (error) {
              setDerivedError(error instanceof Error ? error.message : 'No se pudo guardar el JSON.');
            }
          }}>
            Guardar formulas
          </AppButton>
          <View style={styles.buttonStack}>
            {MEASURE_TYPES.map((entry) => (
              <AppButton key={entry} tone="secondary" onPress={() => addComponent(selectedComponent.id, entry)}>
                {`Agregar ${MEASURE_LABELS[entry].toLowerCase()}`}
              </AppButton>
            ))}
          </View>
          {selectedComponent.id !== job.rootComponent.id ? (
            <AppButton tone="danger" onPress={() => removeComponent(selectedComponent.id)}>Quitar bloque</AppButton>
          ) : null}
        </SectionCard>
      ) : null}

      {selectedComponent ? (
        <SectionCard title="Recetas del bloque" subtitle="Ligadas y disponibles en el mismo flujo.">
          {selectedComponent.recipeBindings.length ? selectedComponent.recipeBindings.map((binding) => {
            const recipe = recipes.find((entry) => entry.id === binding.recipeId);
            if (!recipe) return null;
            return (
              <View key={`${selectedComponent.id}-${binding.recipeId}`} style={styles.recipeCard}>
                <Text style={styles.recipeTitle}>{recipe.name}</Text>
                <Text style={styles.recipeMeta}>{recipe.baseUnit}</Text>
                {recipe.params.map((param) => (
                  <Field key={param.id} label={`${param.label} (${param.unit})`} value={String(binding.paramOverrides[param.id] ?? param.default)} keyboardType="numeric" onChangeText={(raw) => updateRecipeParamOverride(selectedComponent.id, binding.recipeId, param.id, Number(raw) || 0)} />
                ))}
                <AppButton tone="danger" onPress={() => unbindRecipe(selectedComponent.id, binding.recipeId)}>Quitar receta</AppButton>
              </View>
            );
          }) : <Text style={styles.muted}>Todavia no hay recetas ligadas.</Text>}
          {availableRecipes.length ? availableRecipes.map((recipe) => (
            <PressableCard key={recipe.id} eyebrow={recipe.type} meta={recipe.baseUnit} onPress={() => bindRecipe(selectedComponent.id, recipe.id)} subtitle={recipe.description || 'Sin descripcion'} title={recipe.name} />
          )) : null}
        </SectionCard>
      ) : null}

      {result ? (
        <SectionCard title="Totales y salida" subtitle="Ultimo paso antes de generar la estimacion.">
          <MiniStat label="Total general" value={total} wide />
          <MiniStat label="Costo por unidad" value={result.totals.costPerUnit === null ? 'N/A' : formatCurrency(result.totals.costPerUnit, job.currency, locale)} wide />
          <MiniStat label="Unidad base" value={result.totals.unitLabel} wide />
          {result.materials.map((line) => (
            <View key={line.materialId} style={styles.listRow}>
              <View style={styles.flex}>
                <Text style={styles.listTitle}>{line.materialName}</Text>
                <Text style={styles.listMeta}>{`${line.qty} ${line.unit}`}</Text>
              </View>
              <Text style={styles.listAmount}>{formatCurrency(line.subtotal, job.currency, locale)}</Text>
            </View>
          ))}
          {result.errors.length ? (
            <View style={styles.warningBox}>
              {result.errors.map((error) => (
                <Text key={error} style={styles.errorText}>{`\u2022 ${error}`}</Text>
              ))}
            </View>
          ) : null}
          <AppButton icon={<Ionicons color="#04111d" name="document-text-outline" size={18} />} onPress={() => pushAppRoute(appRoutes.builderEstimatePreview(job.id))} size="lg">
            Generar estimado
          </AppButton>
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function MiniStat(props: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.miniStat, props.wide ? styles.miniStatWide : null]}>
      <Text style={styles.miniStatLabel}>{props.label}</Text>
      <Text style={styles.miniStatValue}>{props.value}</Text>
    </View>
  );
}

function ComponentNode(props: { component: QuoteComponent; selectedId: string | null; onSelect: (componentId: string) => void; depth?: number }) {
  const { component, selectedId, onSelect, depth = 0 } = props;
  return (
    <View style={styles.treeStack}>
      <Pressable onPress={() => onSelect(component.id)} style={[styles.nodeCard, { marginLeft: depth * 12 }, selectedId === component.id ? styles.nodeCardActive : null]}>
        <Text style={styles.nodeTitle}>{component.name}</Text>
        <Text style={styles.nodeMeta}>{`${MEASURE_LABELS[component.measureType]} · ${component.baseMeasure.expr}`}</Text>
      </Pressable>
      {component.children.map((child) => (
        <ComponentNode key={child.id} component={child} depth={depth + 1} onSelect={onSelect} selectedId={selectedId} />
      ))}
    </View>
  );
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'default' | 'numeric'; multiline?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput keyboardType={props.keyboardType ?? 'default'} multiline={props.multiline ?? false} onChangeText={props.onChangeText} placeholder={props.label} placeholderTextColor={colors.textPlaceholder} style={[styles.input, props.multiline ? styles.textarea : null]} value={props.value} />
    </View>
  );
}

function countComponents(component: QuoteComponent): number {
  return 1 + component.children.reduce((sum, child) => sum + countComponents(child), 0);
}

function containsComponent(component: QuoteComponent, componentId: string): boolean {
  return component.id === componentId || component.children.some((child) => containsComponent(child, componentId));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#edf3fa' },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: '#edf3fa' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#10233F' },
  hero: { borderRadius: 28, backgroundColor: '#071120', padding: spacing.xl, gap: spacing.md },
  heroEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: '#fcd34d' },
  heroTitle: { fontSize: 30, lineHeight: 34, fontWeight: '800', color: '#f8fbff' },
  heroSubtitle: { fontSize: 15, lineHeight: 22, color: '#b5c9de' },
  statsRow: { gap: spacing.sm },
  heroButtons: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  miniStat: { borderRadius: radii.xl, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: '#f8fbff', padding: spacing.md, gap: spacing.xs },
  miniStatWide: { backgroundColor: '#f8fbff' },
  miniStatLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: '#6b7a90' },
  miniStatValue: { fontSize: 16, lineHeight: 22, fontWeight: '800', color: '#10233F' },
  field: { gap: spacing.sm },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', color: '#6b7a90' },
  input: { minHeight: 56, borderRadius: radii.lg, borderWidth: 1, borderColor: '#d1dbe8', backgroundColor: '#f8fbff', paddingHorizontal: spacing.md, fontSize: 16, color: '#10233F' },
  textarea: { minHeight: 104, paddingTop: spacing.md, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickChip: { borderRadius: radii.pill, backgroundColor: '#10233F', paddingHorizontal: 14, paddingVertical: 10 },
  quickChipPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  quickChipText: { fontSize: 13, fontWeight: '700', color: '#f8fbff' },
  activeCard: { borderRadius: radii.xl, backgroundColor: '#f2f7fe', borderWidth: 1, borderColor: '#d8e2ef', padding: spacing.md, gap: 4 },
  activeTitle: { fontSize: 17, fontWeight: '800', color: '#10233F' },
  activeMeta: { fontSize: 13, color: '#61758b' },
  helperTitle: { fontSize: 14, fontWeight: '800', color: '#10233F' },
  measureChip: { borderRadius: radii.pill, borderWidth: 1, borderColor: '#d1dbe8', backgroundColor: '#f8fbff', paddingHorizontal: 14, paddingVertical: 10 },
  measureChipActive: { borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.12)' },
  measureChipText: { fontSize: 13, fontWeight: '700', color: '#556a81' },
  measureChipTextActive: { color: '#0e709e' },
  buttonStack: { gap: spacing.sm },
  recipeCard: { borderRadius: radii.xl, borderWidth: 1, borderColor: '#d8e2ef', backgroundColor: '#f8fbff', padding: spacing.md, gap: spacing.sm },
  recipeTitle: { fontSize: 16, fontWeight: '800', color: '#10233F' },
  recipeMeta: { fontSize: 13, color: '#61758b' },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radii.xl, borderWidth: 1, borderColor: '#d8e2ef', backgroundColor: '#f8fbff', padding: spacing.md },
  listTitle: { fontSize: 15, fontWeight: '800', color: '#10233F' },
  listMeta: { fontSize: 13, color: '#61758b' },
  listAmount: { fontSize: 14, fontWeight: '800', color: '#10233F' },
  warningBox: { borderRadius: radii.xl, borderWidth: 1, borderColor: '#f4c7c7', backgroundColor: '#fff3f3', padding: spacing.md, gap: spacing.xs },
  errorText: { fontSize: 13, lineHeight: 20, color: '#b42318' },
  muted: { fontSize: 14, lineHeight: 20, color: '#61758b' },
  treeStack: { gap: spacing.sm },
  nodeCard: { borderRadius: radii.xl, borderWidth: 1, borderColor: '#d8e2ef', backgroundColor: '#f8fbff', padding: spacing.md, gap: 4 },
  nodeCardActive: { borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.08)' },
  nodeTitle: { fontSize: 15, fontWeight: '800', color: '#10233F' },
  nodeMeta: { fontSize: 13, color: '#61758b' },
});
