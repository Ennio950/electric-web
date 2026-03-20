import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/useAppStore';
import { ImportExportPanel } from '@/features/importExport/ImportExportPanel';
import { FolderOpen, PlayCircle, Trash2 } from 'lucide-react';

const schema = z.object({
  name: z.string().min(2, 'Ingresa un nombre de trabajo'),
  currency: z.string().min(1, 'Moneda requerida')
});

type FormValues = z.infer<typeof schema>;

export function DashboardPage() {
  const navigate = useNavigate();
  const jobs = useAppStore((state) => state.jobs);
  const createJob = useAppStore((state) => state.createJob);
  const setCurrentJobId = useAppStore((state) => state.setCurrentJobId);
  const deleteJob = useAppStore((state) => state.deleteJob);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: 'Nuevo trabajo',
      currency: 'GTQ'
    }
  });

  const submit = form.handleSubmit((values) => {
    const job = createJob(values.name, values.currency);
    navigate(`/job/${job.id}/builder`);
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Crear trabajo</CardTitle>
            <CardDescription>
              Inicia desde cero. Luego agrega partes, recetas y calcula costos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del trabajo</Label>
                <Input id="name" {...form.register('name')} />
                {form.formState.errors.name ? (
                  <p className="text-xs text-red-300">{form.formState.errors.name.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Moneda (ISO)</Label>
                <Input id="currency" {...form.register('currency')} />
                {form.formState.errors.currency ? (
                  <p className="text-xs text-red-300">{form.formState.errors.currency.message}</p>
                ) : null}
              </div>

              <Button type="submit" className="w-full">
                <PlayCircle className="mr-2 h-4 w-4" /> Crear y abrir
              </Button>
            </form>
          </CardContent>
        </Card>

        <ImportExportPanel />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trabajos guardados</CardTitle>
          <CardDescription>Abre en modo asistido o revisa resultados inmediatamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!jobs.length ? (
            <p className="text-sm text-muted-foreground">No hay trabajos guardados.</p>
          ) : null}

          {jobs.map((job) => (
            <div key={job.id} className="rounded-md border border-border bg-secondary/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{job.name}</p>
                  <p className="text-xs text-muted-foreground">Actualizado: {new Date(job.updatedAt).toLocaleString('es-GT')}</p>
                </div>
                <Badge variant="outline">{job.currency}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCurrentJobId(job.id);
                    navigate(`/job/${job.id}/builder`);
                  }}
                >
                  <FolderOpen className="mr-2 h-4 w-4" /> Abrir constructor
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCurrentJobId(job.id);
                    navigate(`/job/${job.id}/results`);
                  }}
                >
                  Ver resultados
                </Button>
                <Button variant="ghost" onClick={() => deleteJob(job.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

