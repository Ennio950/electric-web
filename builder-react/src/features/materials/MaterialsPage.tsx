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
import { useAppStore } from '@/store/useAppStore';
import { uid } from '@/lib/utils';
import { downloadJson, readJsonFile } from '@/features/importExport/jsonIO';

const schema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  category: z.string().min(2),
  baseUnit: z.string().min(1),
  unitPrice: z.coerce.number().nonnegative(),
  currency: z.string().min(1),
  densityKgPerM3: z.coerce.number().positive().optional(),
  conversionsText: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

export function MaterialsPage() {
  const materials = useAppStore((state) => state.materials);
  const saveMaterial = useAppStore((state) => state.saveMaterial);
  const removeMaterial = useAppStore((state) => state.removeMaterial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const editingItem = useMemo(
    () => materials.find((material) => material.id === editingId) ?? null,
    [materials, editingId]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      id: uid('mat'),
      name: '',
      category: 'general',
      baseUnit: 'm2',
      unitPrice: 0,
      currency: 'GTQ',
      conversionsText: ''
    }
  });

  const submit = form.handleSubmit((values) => {
    const conversions = (values.conversionsText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [pair, factorRaw] = line.split('=');
        const [from, to] = (pair || '').split('>');
        return {
          from: (from || '').trim(),
          to: (to || '').trim(),
          factor: Number((factorRaw || '0').trim())
        };
      })
      .filter((item) => item.from && item.to && Number.isFinite(item.factor) && item.factor > 0);

    saveMaterial({
      id: values.id,
      name: values.name,
      category: values.category,
      baseUnit: values.baseUnit,
      unitPrice: values.unitPrice,
      currency: values.currency,
      densityKgPerM3: values.densityKgPerM3,
      conversions
    });

    setEditingId(null);
    form.reset({
      id: uid('mat'),
      name: '',
      category: 'general',
      baseUnit: 'm2',
      unitPrice: 0,
      currency: values.currency,
      conversionsText: ''
    });
  });

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Catalogo de materiales</CardTitle>
              <CardDescription>Base universal de precios y conversiones.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => downloadJson(`materials-${Date.now()}.json`, materials)}>
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
                list.forEach((row) => saveMaterial(row as never));
              } finally {
                event.target.value = '';
              }
            }}
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material) => (
                <TableRow key={material.id}>
                  <TableCell>{material.name}</TableCell>
                  <TableCell>{material.category}</TableCell>
                  <TableCell>{material.baseUnit}</TableCell>
                  <TableCell>{material.unitPrice.toFixed(2)} {material.currency}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(material.id);
                          form.reset({
                            id: material.id,
                            name: material.name,
                            category: material.category,
                            baseUnit: material.baseUnit,
                            unitPrice: material.unitPrice,
                            currency: material.currency,
                            densityKgPerM3: material.densityKgPerM3,
                            conversionsText: (material.conversions || [])
                              .map((item) => `${item.from}>${item.to}=${item.factor}`)
                              .join('\n')
                          });
                        }}
                      >
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeMaterial(material.id)}>
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
          <CardTitle>{editingItem ? 'Editar material' : 'Nuevo material'}</CardTitle>
          <CardDescription>
            Conversiones en formato: <strong>from&gt;to=factor</strong>, una por linea.
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
                <Label>Categoria</Label>
                <Input {...form.register('category')} />
              </div>
              <div className="space-y-2">
                <Label>Unidad base</Label>
                <Input {...form.register('baseUnit')} />
              </div>
              <div className="space-y-2">
                <Label>Precio unitario</Label>
                <Input {...form.register('unitPrice')} />
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Input {...form.register('currency')} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Densidad kg/m3 (opcional)</Label>
                <Input {...form.register('densityKgPerM3')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Conversiones</Label>
              <Textarea rows={6} {...form.register('conversionsText')} />
            </div>

            <div className="flex gap-2">
              <Button type="submit">Guardar material</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  form.reset({
                    id: uid('mat'),
                    name: '',
                    category: 'general',
                    baseUnit: 'm2',
                    unitPrice: 0,
                    currency: 'GTQ',
                    conversionsText: ''
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
