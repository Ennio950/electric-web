import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ComponentTreePanel } from '@/features/componentsTree/ComponentTreePanel';
import { useAppStore, useCurrentJob, useSelectedComponent } from '@/store/useAppStore';
import { applyMeasurePreset } from '@/features/componentsTree/measurePresets';
import type { MeasureType } from '@/schemas/component.schema';
import { GuidedStepper } from './GuidedStepper';
import { calculateJob } from '@/core/calculator';

const STEPS = ['Medicion', 'Recetas', 'Materiales y precios', 'Mano de obra y desperdicio'];

const measureTypeOptions = [
  { value: 'AREA', label: 'Area' },
  { value: 'VOLUME', label: 'Volumen' },
  { value: 'LENGTH', label: 'Longitud' },
  { value: 'COUNT', label: 'Cantidad' },
  { value: 'ASSEMBLY', label: 'Ensamble' },
  { value: 'TIME', label: 'Tiempo' },
  { value: 'CUSTOM_FORMULA', label: 'Formula personalizada' }
];

function parseNumber(value: string) {
  const normalized = value.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function JobBuilderPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [step, setStep] = useState(0);

  const mode = useAppStore((state) => state.mode);
  const setCurrentJobId = useAppStore((state) => state.setCurrentJobId);
  const updateCurrentJobMeta = useAppStore((state) => state.updateCurrentJobMeta);
  const updateComponent = useAppStore((state) => state.updateComponent);
  const addComponent = useAppStore((state) => state.addComponent);
  const saveMaterial = useAppStore((state) => state.saveMaterial);
  const materials = useAppStore((state) => state.materials);
  const recipes = useAppStore((state) => state.recipes);

  const job = useCurrentJob();
  const component = useSelectedComponent();

  const routeJobId = params.jobId;
  useEffect(() => {
    if (routeJobId && job?.id !== routeJobId) {
      setCurrentJobId(routeJobId);
    }
  }, [routeJobId, job?.id, setCurrentJobId]);

  const quickResult = useMemo(() => {
    if (!job) return null;
    return calculateJob(job, materials, recipes);
  }, [job, materials, recipes]);

  if (!job || !component) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Constructor</CardTitle>
          <CardDescription>No se encontro trabajo o componente activo.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const boundRecipeIds = new Set(component.recipeBindings.map((item) => item.recipeId));

  const materialsFromBindings = recipes
    .filter((recipe) => boundRecipeIds.has(recipe.id))
    .flatMap((recipe) => recipe.outputs.map((output) => output.materialId))
    .map((materialId) => materials.find((mat) => mat.id === materialId))
    .filter(Boolean);

  const uniqueMaterials = Array.from(new Map(materialsFromBindings.map((mat) => [mat!.id, mat!])).values());

  const canCalculate = component.recipeBindings.some((binding) => binding.enabled);

  return (
    <div className="app-grid">
      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Progreso asistido</CardTitle>
            <CardDescription>Edita la parte seleccionada paso por paso.</CardDescription>
          </CardHeader>
          <CardContent>
            <GuidedStepper currentStep={step} steps={STEPS} />
          </CardContent>
        </Card>

        <ComponentTreePanel />
      </div>

      <Card className="h-full">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>{component.name}</CardTitle>
              <CardDescription>
                Modo {mode === 'assistant' ? 'asistido' : 'experto'} · Paso {step + 1} de {STEPS.length}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => addComponent(component.id, 'AREA')}>
              + Agregar subparte
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 ? (
            <section className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre de la parte</Label>
                  <Input
                    value={component.name}
                    onChange={(event) =>
                      updateComponent(component.id, (current) => ({
                        ...current,
                        name: event.target.value || 'Parte sin nombre'
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Metodo de medicion</Label>
                  <SelectField
                    value={component.measureType}
                    options={measureTypeOptions.filter((option) => mode === 'expert' || option.value !== 'CUSTOM_FORMULA')}
                    onChange={(event) => {
                      const nextType = event.target.value as MeasureType;
                      updateComponent(component.id, (current) => applyMeasurePreset(current, nextType));
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {component.inputs.map((input) => (
                  <div key={input.id} className="space-y-2">
                    <Label>{input.label} ({input.unit})</Label>
                    <Input
                      value={component.inputValues[input.id] ?? ''}
                      placeholder={input.example || ''}
                      onChange={(event) => {
                        const value = parseNumber(event.target.value);
                        updateComponent(component.id, (current) => ({
                          ...current,
                          inputValues: {
                            ...current.inputValues,
                            [input.id]: value
                          }
                        }));
                      }}
                    />
                    {input.help ? <p className="text-xs text-muted-foreground">{input.help}</p> : null}
                  </div>
                ))}
              </div>

              {mode === 'expert' ? (
                <div className="space-y-3 rounded-md border border-border bg-secondary/20 p-3">
                  <h4 className="font-semibold">Editor experto de formulas</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Unidad base</Label>
                      <Input
                        value={component.baseMeasure.unit}
                        onChange={(event) =>
                          updateComponent(component.id, (current) => ({
                            ...current,
                            baseMeasure: {
                              ...current.baseMeasure,
                              unit: event.target.value
                            }
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label>Formula base</Label>
                      <Input
                        value={component.baseMeasure.expr}
                        onChange={(event) =>
                          updateComponent(component.id, (current) => ({
                            ...current,
                            baseMeasure: {
                              ...current.baseMeasure,
                              expr: event.target.value
                            }
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Variables derivadas (una por linea: id=formula)</Label>
                    <Textarea
                      rows={6}
                      value={component.derived.map((item) => `${item.id}=${item.formula}`).join('\n')}
                      onChange={(event) => {
                        const lines = event.target.value.split('\n').map((line) => line.trim()).filter(Boolean);
                        const nextDerived = lines.map((line) => {
                          const [id, ...rest] = line.split('=');
                          return {
                            id: id.trim(),
                            label: id.trim(),
                            formula: rest.join('=').trim() || '0',
                            unit: ''
                          };
                        });
                        updateComponent(component.id, (current) => ({
                          ...current,
                          derived: nextDerived
                        }));
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {step === 1 ? (
            <section className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Selecciona una o varias recetas para esta parte. Puedes ajustar parametros sin tocar formulas.
              </p>

              <div className="grid gap-2 md:grid-cols-2">
                {recipes.map((recipe) => {
                  const active = component.recipeBindings.some((item) => item.recipeId === recipe.id);
                  return (
                    <button
                      type="button"
                      key={recipe.id}
                      onClick={() => {
                        updateComponent(component.id, (current) => {
                          const has = current.recipeBindings.some((item) => item.recipeId === recipe.id);
                          if (has) {
                            return {
                              ...current,
                              recipeBindings: current.recipeBindings.filter((item) => item.recipeId !== recipe.id)
                            };
                          }

                          return {
                            ...current,
                            recipeBindings: [
                              ...current.recipeBindings,
                              {
                                recipeId: recipe.id,
                                enabled: true,
                                paramOverrides: {}
                              }
                            ]
                          };
                        });
                      }}
                      className={`rounded-md border p-3 text-left ${active ? 'border-primary bg-primary/15' : 'border-border bg-secondary/25'}`}
                    >
                      <p className="font-semibold">{recipe.name}</p>
                      <p className="text-xs text-muted-foreground">{recipe.type} · base {recipe.baseUnit}</p>
                    </button>
                  );
                })}
              </div>

              {component.recipeBindings.map((binding) => {
                const recipe = recipes.find((item) => item.id === binding.recipeId);
                if (!recipe) return null;

                return (
                  <div key={binding.recipeId} className="rounded-md border border-border bg-secondary/20 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="font-semibold">{recipe.name}</h4>
                      <Badge variant="outline">{recipe.baseUnit}</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {recipe.params.map((param) => {
                        const value = binding.paramOverrides[param.id] ?? param.default;
                        return (
                          <div key={param.id} className="space-y-1">
                            <Label>{param.label} ({param.unit})</Label>
                            <Input
                              value={value}
                              onChange={(event) => {
                                const numeric = parseNumber(event.target.value);
                                updateComponent(component.id, (current) => ({
                                  ...current,
                                  recipeBindings: current.recipeBindings.map((row) =>
                                    row.recipeId === binding.recipeId
                                      ? {
                                          ...row,
                                          paramOverrides: {
                                            ...row.paramOverrides,
                                            [param.id]: numeric
                                          }
                                        }
                                      : row
                                  )
                                }));
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {mode === 'expert' ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Expr salida: {recipe.outputs.map((out) => `${out.materialId}: ${out.qtyExpr}`).join(' | ')}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Define el precio por unidad de cada insumo usado por las recetas seleccionadas.
              </p>
              {!uniqueMaterials.length ? (
                <p className="text-sm text-muted-foreground">Aun no hay materiales porque no seleccionaste recetas.</p>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                {uniqueMaterials.map((material) => (
                  <div key={material.id} className="rounded-md border border-border bg-secondary/20 p-3">
                    <p className="font-semibold">Precio por unidad</p>
                    <p className="text-xs text-muted-foreground">
                      Referencia: {material.name} · Unidad base: {material.baseUnit}
                    </p>
                    <div className="mt-2 space-y-1">
                      <Label>Valor por {material.baseUnit}</Label>
                      <Input
                        value={material.unitPrice}
                        placeholder={`Ej. ${material.unitPrice}`}
                        onChange={(event) => {
                          const unitPrice = parseNumber(event.target.value);
                          saveMaterial({ ...material, unitPrice });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Merma de esta parte (%)</Label>
                  <Input
                    value={component.wastePct}
                    onChange={(event) => {
                      const wastePct = parseNumber(event.target.value);
                      updateComponent(component.id, (current) => ({ ...current, wastePct }));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Modo mano de obra</Label>
                  <SelectField
                    value={component.labor.mode}
                    options={[
                      { value: 'NONE', label: 'Sin mano de obra' },
                      { value: 'PER_COMPONENT', label: 'Monto fijo por parte' },
                      { value: 'PER_BASE_UNIT', label: 'Por unidad base' },
                      { value: 'PER_HOUR', label: 'Por horas' }
                    ]}
                    onChange={(event) => {
                      const modeValue = event.target.value as 'NONE' | 'PER_COMPONENT' | 'PER_BASE_UNIT' | 'PER_HOUR';
                      updateComponent(component.id, (current) => ({
                        ...current,
                        labor: {
                          ...current.labor,
                          mode: modeValue
                        }
                      }));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tarifa de mano de obra</Label>
                  <Input
                    value={component.labor.rate}
                    onChange={(event) => {
                      const rate = parseNumber(event.target.value);
                      updateComponent(component.id, (current) => ({
                        ...current,
                        labor: {
                          ...current.labor,
                          rate
                        }
                      }));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Horas (si aplica)</Label>
                  <Input
                    value={component.labor.hours}
                    onChange={(event) => {
                      const hours = parseNumber(event.target.value);
                      updateComponent(component.id, (current) => ({
                        ...current,
                        labor: {
                          ...current.labor,
                          hours
                        }
                      }));
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Merma global del trabajo (%)</Label>
                  <Input
                    value={job.globalWastePct}
                    onChange={(event) => updateCurrentJobMeta({ globalWastePct: parseNumber(event.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Costo fijo</Label>
                  <Input
                    value={job.fixedCost}
                    onChange={(event) => updateCurrentJobMeta({ fixedCost: parseNumber(event.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Impuesto (%)</Label>
                  <Input
                    value={job.tax.pct}
                    onChange={(event) =>
                      updateCurrentJobMeta({
                        tax: {
                          ...job.tax,
                          enabled: parseNumber(event.target.value) > 0,
                          pct: parseNumber(event.target.value)
                        }
                      })
                    }
                  />
                </div>
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
              Anterior
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(`/job/${job.id}/results`)}
                disabled={!canCalculate}
              >
                Calcular
              </Button>
              <Button
                onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))}
                disabled={step >= STEPS.length - 1}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen rapido</CardTitle>
          <CardDescription>Estado actual del trabajo en tiempo real.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-border bg-secondary/25 p-3">
            <p className="text-xs text-muted-foreground">Recetas activas</p>
            <p className="text-2xl font-bold">{component.recipeBindings.length}</p>
          </div>

          <div className="rounded-md border border-border bg-secondary/25 p-3">
            <p className="text-xs text-muted-foreground">Materiales distintos</p>
            <p className="text-2xl font-bold">{quickResult?.materials.length ?? 0}</p>
          </div>

          <div className="rounded-md border border-border bg-secondary/25 p-3">
            <p className="text-xs text-muted-foreground">Errores de calculo</p>
            <p className="text-2xl font-bold text-red-300">{quickResult?.errors.length ?? 0}</p>
          </div>

          {!canCalculate ? (
            <p className="text-sm text-amber-300">
              Debes agregar al menos una receta para habilitar el calculo.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}


