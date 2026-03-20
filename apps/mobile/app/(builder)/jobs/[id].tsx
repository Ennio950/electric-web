import { calculateJob, componentDerivedSchema, type MeasureType, type QuoteComponent } from '@electric/estimator-core';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { PressableCard } from '@/src/components/PressableCard';
import { SectionCard } from '@/src/components/SectionCard';
import { formatCurrency } from '@/src/lib/formatters';
import { appRoutes, replaceAppRoute } from '@/src/navigation/routes';
import {
  useBuilderStore,
  useCurrentBuilderJob,
  useSelectedBuilderComponent
} from '@/src/stores/builderStore';
import { useSessionStore } from '@/src/stores/sessionStore';

const MEASURE_TYPES: MeasureType[] = ['AREA', 'VOLUME', 'LENGTH', 'COUNT', 'ASSEMBLY', 'TIME', 'CUSTOM_FORMULA'];
const LABOR_MODES = ['NONE', 'PER_COMPONENT', 'PER_BASE_UNIT', 'PER_HOUR'] as const;

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
    if (!jobId) return;
    if (currentJobId !== jobId) {
      setCurrentJobId(jobId);
    }
  }, [currentJobId, jobId, setCurrentJobId]);

  useEffect(() => {
    setDerivedJson(JSON.stringify(selectedComponent?.derived ?? [], null, 2));
    setDerivedError(null);
  }, [selectedComponent?.id, selectedComponent?.derived]);

  const currentJob = useMemo(() => jobs.find((entry) => entry.id === jobId) ?? null, [jobId, jobs]);
  const result = job ? calculateJob(job, materials, recipes) : null;

  if (!bootstrap) {
    return null;
  }

  if (!currentJob || !job) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Este job ya no existe.</Text>
        <AppButton onPress={() => replaceAppRoute(appRoutes.builderHome)}>Volver al builder</AppButton>
      </View>
    );
  }

  const boundRecipeIds = new Set(selectedComponent?.recipeBindings.map((binding) => binding.recipeId) ?? []);
  const availableRecipes = recipes.filter((recipe) => !boundRecipeIds.has(recipe.id));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard title="Meta del job" subtitle="Nombre, moneda y costos globales del cálculo.">
        <Field
          label="Nombre"
          value={job.name}
          onChangeText={(name) => updateCurrentJobMeta({ name })}
        />
        <View style={styles.row}>
          <View style={styles.flexField}>
            <Field
              label="Moneda"
              value={job.currency}
              onChangeText={(currency) => updateCurrentJobMeta({ currency })}
            />
          </View>
          <View style={styles.flexField}>
            <Field
              label="Waste global %"
              value={String(job.globalWastePct)}
              keyboardType="numeric"
              onChangeText={(raw) => updateCurrentJobMeta({ globalWastePct: Number(raw) || 0 })}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flexField}>
            <Field
              label="Costo fijo"
              value={String(job.fixedCost)}
              keyboardType="numeric"
              onChangeText={(raw) => updateCurrentJobMeta({ fixedCost: Number(raw) || 0 })}
            />
          </View>
          <View style={styles.flexField}>
            <Field
              label="Impuesto %"
              value={String(job.tax.pct)}
              keyboardType="numeric"
              onChangeText={(raw) => updateCurrentJobMeta({ tax: { ...job.tax, pct: Number(raw) || 0 } })}
            />
          </View>
        </View>
        <View style={styles.buttonRow}>
          <AppButton tone="danger" onPress={() => {
            deleteJob(job.id);
            replaceAppRoute(appRoutes.builderHome);
          }}
          >
            Eliminar job
          </AppButton>
        </View>
      </SectionCard>

      <SectionCard title="Árbol de componentes" subtitle="Selecciona un nodo para editar inputs y bindings.">
        <ComponentNode
          component={job.rootComponent}
          selectedId={selectedComponentId}
          onSelect={setSelectedComponentId}
        />
      </SectionCard>

      {selectedComponent ? (
        <SectionCard title="Editor del componente" subtitle="Inputs, medida y bindings del nodo seleccionado.">
          <Field
            label="Nombre del componente"
            value={selectedComponent.name}
            onChangeText={(name) => updateComponentName(selectedComponent.id, name)}
          />

          <View style={styles.measureGrid}>
            {MEASURE_TYPES.map((measureType) => (
              <Pressable
                key={measureType}
                onPress={() => updateComponentMeasureType(selectedComponent.id, measureType)}
                style={[
                  styles.measureChip,
                  selectedComponent.measureType === measureType ? styles.measureChipActive : null
                ]}
              >
                <Text
                  style={[
                    styles.measureChipText,
                    selectedComponent.measureType === measureType ? styles.measureChipTextActive : null
                  ]}
                >
                  {measureType}
                </Text>
              </Pressable>
            ))}
          </View>

          {selectedComponent.inputs.map((input) => (
            <Field
              key={input.id}
              label={`${input.label} (${input.unit})`}
              value={String(selectedComponent.inputValues[input.id] ?? '')}
              keyboardType="numeric"
              onChangeText={(raw) => updateComponentInputValue(selectedComponent.id, input.id, Number(raw) || 0)}
            />
          ))}

          <View style={styles.row}>
            <View style={styles.flexField}>
              <Field
                label="Unidad base"
                value={selectedComponent.baseMeasure.unit}
                onChangeText={(unit) => updateComponentBaseMeasure(selectedComponent.id, { unit })}
              />
            </View>
            <View style={styles.flexField}>
              <Field
                label="Waste %"
                value={String(selectedComponent.wastePct)}
                keyboardType="numeric"
                onChangeText={(raw) => updateComponentWastePct(selectedComponent.id, Number(raw) || 0)}
              />
            </View>
          </View>

          <Field
            label="Fórmula base"
            value={selectedComponent.baseMeasure.expr}
            multiline
            onChangeText={(expr) => updateComponentBaseMeasure(selectedComponent.id, { expr })}
          />

          <View style={styles.stack}>
            <Text style={styles.helperTitle}>Modo de labor</Text>
            <View style={styles.measureGrid}>
              {LABOR_MODES.map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => updateComponentLabor(selectedComponent.id, { mode })}
                  style={[
                    styles.measureChip,
                    selectedComponent.labor.mode === mode ? styles.measureChipActive : null
                  ]}
                >
                  <Text
                    style={[
                      styles.measureChipText,
                      selectedComponent.labor.mode === mode ? styles.measureChipTextActive : null
                    ]}
                  >
                    {mode}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {selectedComponent.labor.mode !== 'NONE' ? (
            <View style={styles.row}>
              <View style={styles.flexField}>
                <Field
                  label="Tarifa labor"
                  value={String(selectedComponent.labor.rate)}
                  keyboardType="numeric"
                  onChangeText={(raw) => updateComponentLabor(selectedComponent.id, { rate: Number(raw) || 0 })}
                />
              </View>
              <View style={styles.flexField}>
                <Field
                  label="Horas"
                  value={String(selectedComponent.labor.hours)}
                  keyboardType="numeric"
                  onChangeText={(raw) => updateComponentLabor(selectedComponent.id, { hours: Number(raw) || 0 })}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.stack}>
            <Text style={styles.helperTitle}>Fórmulas derivadas</Text>
            <Field
              label="Derived JSON"
              value={derivedJson}
              multiline
              onChangeText={setDerivedJson}
            />
            <Text style={styles.muted}>
              Usa ids cortos como variables auxiliares. Ejemplo: [{'{'}"id":"perimetro","formula":"(largo + ancho) * 2"{'}'}]
            </Text>
            {derivedError ? <Text style={styles.errorText}>{derivedError}</Text> : null}
            <View style={styles.buttonRowStart}>
              <AppButton
                tone="secondary"
                onPress={() => {
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
                    setDerivedError(error instanceof Error ? error.message : 'No se pudo leer el JSON derivado.');
                  }
                }}
              >
                Guardar fórmulas
              </AppButton>
            </View>
          </View>

          <View style={styles.buttonGrid}>
            <AppButton tone="secondary" onPress={() => addComponent(selectedComponent.id, 'AREA')}>
              Agregar área
            </AppButton>
            <AppButton tone="secondary" onPress={() => addComponent(selectedComponent.id, 'VOLUME')}>
              Agregar volumen
            </AppButton>
            <AppButton tone="secondary" onPress={() => addComponent(selectedComponent.id, 'LENGTH')}>
              Agregar longitud
            </AppButton>
            <AppButton tone="secondary" onPress={() => addComponent(selectedComponent.id, 'COUNT')}>
              Agregar cantidad
            </AppButton>
            <AppButton tone="secondary" onPress={() => addComponent(selectedComponent.id, 'ASSEMBLY')}>
              Agregar ensamblaje
            </AppButton>
            <AppButton tone="secondary" onPress={() => addComponent(selectedComponent.id, 'TIME')}>
              Agregar tiempo
            </AppButton>
            <AppButton tone="secondary" onPress={() => addComponent(selectedComponent.id, 'CUSTOM_FORMULA')}>
              Agregar fórmula
            </AppButton>
          </View>

          {selectedComponent.id !== job.rootComponent.id ? (
            <View style={styles.buttonRow}>
              <AppButton tone="danger" onPress={() => removeComponent(selectedComponent.id)}>
                Quitar componente
              </AppButton>
            </View>
          ) : null}
        </SectionCard>
      ) : null}

      {selectedComponent ? (
        <SectionCard title="Bindings de recetas" subtitle="Liga recetas existentes y ajusta sus overrides.">
          {selectedComponent.recipeBindings.length ? selectedComponent.recipeBindings.map((binding) => {
            const recipe = recipes.find((entry) => entry.id === binding.recipeId);
            if (!recipe) return null;

            return (
              <View key={`${selectedComponent.id}-${binding.recipeId}`} style={styles.bindingCard}>
                <Text style={styles.bindingTitle}>{recipe.name}</Text>
                {recipe.params.map((param) => (
                  <Field
                    key={param.id}
                    label={`${param.label} (${param.unit})`}
                    value={String(binding.paramOverrides[param.id] ?? param.default)}
                    keyboardType="numeric"
                    onChangeText={(raw) => updateRecipeParamOverride(
                      selectedComponent.id,
                      binding.recipeId,
                      param.id,
                      Number(raw) || 0
                    )}
                  />
                ))}
                <AppButton tone="danger" onPress={() => unbindRecipe(selectedComponent.id, binding.recipeId)}>
                  Quitar receta
                </AppButton>
              </View>
            );
          }) : <Text style={styles.muted}>Este componente todavía no tiene recetas ligadas.</Text>}

          {availableRecipes.length ? (
            <View style={styles.stack}>
              <Text style={styles.helperTitle}>Recetas disponibles</Text>
              {availableRecipes.map((recipe) => (
                <PressableCard
                  key={recipe.id}
                  eyebrow={recipe.type}
                  title={recipe.name}
                  subtitle={recipe.description || 'Sin descripción'}
                  meta={recipe.baseUnit}
                  onPress={() => bindRecipe(selectedComponent.id, recipe.id)}
                />
              ))}
            </View>
          ) : null}
        </SectionCard>
      ) : null}

      {result ? (
        <SectionCard title="Resultados" subtitle="Totales y materiales agregados para este job.">
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Total general</Text>
            <Text style={styles.resultValue}>
              {formatCurrency(result.totals.grandTotal, job.currency, bootstrap.companyConfig.locale)}
            </Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Costo por unidad</Text>
            <Text style={styles.resultMeta}>
              {result.totals.costPerUnit === null
                ? 'N/A'
                : formatCurrency(result.totals.costPerUnit, job.currency, bootstrap.companyConfig.locale)}
            </Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Unidad base</Text>
            <Text style={styles.resultMeta}>{result.totals.unitLabel}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Costo fijo</Text>
            <Text style={styles.resultMeta}>
              {formatCurrency(result.totals.fixedCost, job.currency, bootstrap.companyConfig.locale)}
            </Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Impuesto</Text>
            <Text style={styles.resultMeta}>
              {`${result.totals.taxPct}% · ${formatCurrency(result.totals.taxAmount, job.currency, bootstrap.companyConfig.locale)}`}
            </Text>
          </View>

          {result.materials.map((line) => (
            <View key={line.materialId} style={styles.materialRow}>
              <View style={styles.materialInfo}>
                <Text style={styles.materialName}>{line.materialName}</Text>
                <Text style={styles.materialMeta}>{`${line.qty} ${line.unit}`}</Text>
              </View>
              <Text style={styles.materialTotal}>
                {formatCurrency(line.subtotal, job.currency, bootstrap.companyConfig.locale)}
              </Text>
            </View>
          ))}

          <View style={styles.stack}>
            <Text style={styles.helperTitle}>Breakdown por componente</Text>
            {result.componentBreakdown.map((component) => (
              <View key={component.componentId} style={styles.breakdownRow}>
                <View style={styles.materialInfo}>
                  <Text style={styles.materialName}>
                    {`${'  '.repeat(component.depth)}${component.name}`}
                  </Text>
                  <Text style={styles.materialMeta}>
                    {`${component.baseQty} ${component.baseUnit} · Mat ${formatCurrency(component.materialsSubtotal, job.currency, bootstrap.companyConfig.locale)} · Lab ${formatCurrency(component.laborSubtotal, job.currency, bootstrap.companyConfig.locale)}`}
                  </Text>
                </View>
                <Text style={styles.materialTotal}>
                  {formatCurrency(component.total, job.currency, bootstrap.companyConfig.locale)}
                </Text>
              </View>
            ))}
          </View>

          {result.errors.length ? (
            <View style={styles.stack}>
              <Text style={styles.errorTitle}>Observaciones</Text>
              {result.errors.map((error) => (
                <Text key={error} style={styles.errorText}>{`\u2022 ${error}`}</Text>
              ))}
            </View>
          ) : null}
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function ComponentNode(props: {
  component: QuoteComponent;
  selectedId: string | null;
  onSelect: (componentId: string) => void;
  depth?: number;
}) {
  const { component, selectedId, onSelect, depth = 0 } = props;

  return (
    <View style={styles.stack}>
      <Pressable
        onPress={() => onSelect(component.id)}
        style={[
          styles.componentNode,
          { marginLeft: depth * 12 },
          selectedId === component.id ? styles.componentNodeSelected : null
        ]}
      >
        <Text style={styles.componentTitle}>{component.name}</Text>
        <Text style={styles.componentMeta}>{`${component.measureType} · ${component.baseMeasure.expr}`}</Text>
      </Pressable>
      {component.children.map((child) => (
        <ComponentNode
          key={child.id}
          component={child}
          selectedId={selectedId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}) {
  const { label, value, onChangeText, keyboardType = 'default', multiline = false } = props;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline ? styles.textarea : null]}
        placeholder={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB'
  },
  content: {
    padding: 20,
    gap: 16
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10233F'
  },
  field: {
    gap: 8
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#6B778C'
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D5EA',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#10233F'
  },
  textarea: {
    minHeight: 88,
    paddingTop: 12,
    textAlignVertical: 'top'
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  flexField: {
    flex: 1
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  buttonRowStart: {
    flexDirection: 'row',
    justifyContent: 'flex-start'
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  measureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  measureChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C7D5EA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  measureChipActive: {
    borderColor: '#0B5FFF',
    backgroundColor: '#DDEBFF'
  },
  measureChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A5970'
  },
  measureChipTextActive: {
    color: '#0B5FFF'
  },
  stack: {
    gap: 12
  },
  componentNode: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D8E2F0',
    backgroundColor: '#F8FAFD',
    padding: 14
  },
  componentNodeSelected: {
    borderColor: '#0B5FFF',
    backgroundColor: '#EAF2FF'
  },
  componentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10233F'
  },
  componentMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B778C'
  },
  bindingCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D8E2F0',
    backgroundColor: '#F8FAFD',
    padding: 14,
    gap: 12
  },
  bindingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10233F'
  },
  helperTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10233F'
  },
  muted: {
    fontSize: 14,
    color: '#6B778C'
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  resultLabel: {
    fontSize: 14,
    color: '#4A5970'
  },
  resultValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10233F'
  },
  resultMeta: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10233F'
  },
  materialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center'
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start'
  },
  materialInfo: {
    flex: 1,
    gap: 4
  },
  materialName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10233F'
  },
  materialMeta: {
    fontSize: 13,
    color: '#6B778C'
  },
  materialTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10233F'
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B42318'
  },
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#B42318'
  }
});
