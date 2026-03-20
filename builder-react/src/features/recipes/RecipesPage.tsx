import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SelectField } from '@/components/ui/select';
import { useAppStore } from '@/store/useAppStore';
import { uid } from '@/lib/utils';
import { downloadJson, readJsonFile } from '@/features/importExport/jsonIO';

const schema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  type: z.enum(['BY_AREA', 'BY_VOLUME', 'BY_LENGTH', 'BY_COUNT', 'BY_TIME', 'BY_FORMULA']),
  baseUnit: z.string().min(1),
  paramsText: z.string().min(1),
  outputsText: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

export function RecipesPage() {
  const recipes = useAppStore((state) => state.recipes);
  const saveRecipe = useAppStore((state) => state.saveRecipe);
  const removeRecipe = useAppStore((state) => state.removeRecipe);
  const mode = useAppStore((state) => state.mode);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const editingItem = useMemo(
    () => recipes.find((recipe) => recipe.id === editingId) ?? null,
    [recipes, editingId]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      id: uid('rcp'),
      name: '',
      description: '',
      type: 'BY_AREA',
      baseUnit: 'm2',
      paramsText: 'consumo|Consumo por unidad|unit/m2|1|true',
      outputsText: 'mat_material_area|baseQty * consumo|m2|round|2|0'
    }
  });

  const submit = form.handleSubmit((values) => {
    const params = values.paramsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [id, label, unit, defaultRaw, requiredRaw] = line.split('|');
        return {
          id: (id || '').trim(),
          label: (label || '').trim(),
          unit: (unit || '').trim(),
          default: Number((defaultRaw || '0').trim()),
          required: String(requiredRaw || 'true').trim() !== 'false'
        };
      })
      .filter((row) => row.id && row.label && row.unit);

    const outputs = values.outputsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [materialId, qtyExpr, unit, rounding, decimalsRaw, wasteRaw] = line.split('|');
        return {
          materialId: (materialId || '').trim(),
          qtyExpr: (qtyExpr || '').trim(),
          unit: (unit || '').trim(),
          rounding: (rounding || 'round').trim() as 'none' | 'round' | 'ceil' | 'floor',
          decimals: Number((decimalsRaw || '2').trim()),
          wastePct: wasteRaw != null && wasteRaw !== '' ? Number(wasteRaw.trim()) : undefined
        };
      })
      .filter((row) => row.materialId && row.qtyExpr && row.unit);

    saveRecipe({
      id: values.id,
      name: values.name,
      description: values.description,
      type: values.type,
      baseUnit: values.baseUnit,
      params,
      outputs
    });

    setEditingId(null);
    form.reset({
      id: uid('rcp'),
      name: '',
      description: '',
      type: 'BY_AREA',
      baseUnit: 'm2',
      paramsText: 'consumo|Consumo por unidad|unit/m2|1|true',
      outputsText: 'mat_material_area|baseQty * consumo|m2|round|2|0'
    });
  });

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Recetas universales</CardTitle>
              <CardDescription>
                En modo asistido se usan parametros, en modo experto puedes editar expresiones completas.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => downloadJson(`recipes-${Date.now()}.json`, recipes)}>
                Exportar
              </Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                Importar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto scroll-slim">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const payload = await readJsonFile<unknown>(file);
                const list = Array.isArray(payload) ? payload : [];
                list.forEach((row) => saveRecipe(row as never));
              } finally {
                event.target.value = '';
              }
            }}
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Salidas</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.map((recipe) => (
                <TableRow key={recipe.id}>
                  <TableCell>{recipe.name}</TableCell>
                  <TableCell>{recipe.type}</TableCell>
                  <TableCell>{recipe.baseUnit}</TableCell>
                  <TableCell>{recipe.outputs.length}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(recipe.id);
                          form.reset({
                            id: recipe.id,
                            name: recipe.name,
                            description: recipe.description || '',
                            type: recipe.type,
                            baseUnit: recipe.baseUnit,
                            paramsText: recipe.params
                              .map((row) => `${row.id}|${row.label}|${row.unit}|${row.default}|${row.required}`)
                              .join('\n'),
                            outputsText: recipe.outputs
                              .map((out) => `${out.materialId}|${out.qtyExpr}|${out.unit}|${out.rounding}|${out.decimals}|${out.wastePct ?? ''}`)
                              .join('\n')
                          });
                        }}
                      >
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeRecipe(recipe.id)}>
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingItem ? 'Editar receta' : 'Nueva receta'}</CardTitle>
          <CardDescription>
            Sintaxis params: <strong>id|label|unit|default|required</strong>. Sintaxis outputs: <strong>materialId|qtyExpr|unit|rounding|decimals|wastePct</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submit}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>ID</Label>
                <Input {...form.register('id')} />
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input {...form.register('name')} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <SelectField
                  options={[
                    { value: 'BY_AREA', label: 'BY_AREA' },
                    { value: 'BY_VOLUME', label: 'BY_VOLUME' },
                    { value: 'BY_LENGTH', label: 'BY_LENGTH' },
                    { value: 'BY_COUNT', label: 'BY_COUNT' },
                    { value: 'BY_TIME', label: 'BY_TIME' },
                    { value: 'BY_FORMULA', label: 'BY_FORMULA' }
                  ]}
                  value={form.watch('type')}
                  onChange={(event) => form.setValue('type', event.target.value as FormValues['type'])}
                />
              </div>
              <div className="space-y-2">
                <Label>Unidad base</Label>
                <Input {...form.register('baseUnit')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripcion</Label>
              <Textarea rows={2} {...form.register('description')} />
            </div>

            <div className="space-y-2">
              <Label>Parametros</Label>
              <Textarea rows={5} {...form.register('paramsText')} />
            </div>

            <div className="space-y-2">
              <Label>
                Salidas {mode === 'expert' ? '(modo experto completo)' : '(editable para configuracion avanzada)'}
              </Label>
              <Textarea rows={8} {...form.register('outputsText')} />
            </div>

            <div className="flex gap-2">
              <Button type="submit">Guardar receta</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  form.reset({
                    id: uid('rcp'),
                    name: '',
                    description: '',
                    type: 'BY_AREA',
                    baseUnit: 'm2',
                    paramsText: 'consumo|Consumo por unidad|unit/m2|1|true',
                    outputsText: 'mat_material_area|baseQty * consumo|m2|round|2|0'
                  });
                }}
              >
                Limpiar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
