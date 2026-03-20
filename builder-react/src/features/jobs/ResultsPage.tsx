import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore, useCurrentJob } from '@/store/useAppStore';
import { calculateJob } from '@/core/calculator';
import { formatMoney, formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { downloadJson } from '@/features/importExport/jsonIO';

export function ResultsPage() {
  const navigate = useNavigate();
  const params = useParams();
  const job = useCurrentJob();
  const setCurrentJobId = useAppStore((state) => state.setCurrentJobId);
  const materials = useAppStore((state) => state.materials);
  const recipes = useAppStore((state) => state.recipes);

  const routeJobId = params.jobId;
  useEffect(() => {
    if (routeJobId && job?.id !== routeJobId) {
      setCurrentJobId(routeJobId);
    }
  }, [routeJobId, job?.id, setCurrentJobId]);

  const result = useMemo(() => {
    if (!job) return null;
    return calculateJob(job, materials, recipes);
  }, [job, materials, recipes]);

  if (!job || !result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resultados</CardTitle>
          <CardDescription>No se encontro trabajo activo.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Resultado - {job.name}</CardTitle>
              <CardDescription>Total general y desglose por materiales/componentes.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => navigate(`/job/${job.id}/builder`)}>
                Volver al constructor
              </Button>
              <Button variant="outline" onClick={() => downloadJson(`${job.name}-resultado.json`, { job, result })}>
                Exportar JSON
              </Button>
              <Button variant="outline" onClick={() => window.alert('PDF: modulo preparado, integracion pendiente.')}>Generar PDF</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border border-border bg-secondary/25 p-3">
              <p className="text-xs text-muted-foreground">Total general</p>
              <p className="text-2xl font-bold">{formatMoney(result.totals.grandTotal, result.totals.currency)}</p>
            </div>
            <div className="rounded-md border border-border bg-secondary/25 p-3">
              <p className="text-xs text-muted-foreground">Materiales</p>
              <p className="text-2xl font-bold">{formatMoney(result.totals.materialsSubtotal, result.totals.currency)}</p>
            </div>
            <div className="rounded-md border border-border bg-secondary/25 p-3">
              <p className="text-xs text-muted-foreground">Mano de obra</p>
              <p className="text-2xl font-bold">{formatMoney(result.totals.laborSubtotal, result.totals.currency)}</p>
            </div>
            <div className="rounded-md border border-border bg-secondary/25 p-3">
              <p className="text-xs text-muted-foreground">Costo por unidad</p>
              <p className="text-2xl font-bold">
                {result.totals.costPerUnit != null
                  ? `${formatMoney(result.totals.costPerUnit, result.totals.currency)} / ${result.totals.unitLabel}`
                  : 'N/A'}
              </p>
            </div>
          </div>

          {result.errors.length ? (
            <div className="rounded-md border border-red-400/50 bg-red-500/10 p-3">
              <p className="font-semibold text-red-200">Errores detectados</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-100">
                {result.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.warnings.length ? (
            <div className="rounded-md border border-amber-400/50 bg-amber-500/10 p-3">
              <p className="font-semibold text-amber-200">Advertencias</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100">
                {result.warnings.map((warn) => (
                  <li key={warn}>{warn}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Precio unitario</TableHead>
                  <TableHead>Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.materials.map((line) => (
                  <TableRow key={line.materialId}>
                    <TableCell>{line.materialName}</TableCell>
                    <TableCell>{formatNumber(line.qty, 3)}</TableCell>
                    <TableCell>{line.unit}</TableCell>
                    <TableCell>{formatMoney(line.unitPrice, result.totals.currency)}</TableCell>
                    <TableCell>{formatMoney(line.subtotal, result.totals.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subtotales por componente</CardTitle>
          <CardDescription>Te permite entender donde se concentra el costo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {result.componentBreakdown.map((item) => (
            <div key={item.componentId} className="rounded-md border border-border bg-secondary/20 p-3" style={{ marginLeft: `${item.depth * 12}px` }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{item.name}</p>
                <Badge variant="outline">{formatMoney(item.total, result.totals.currency)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Base: {formatNumber(item.baseQty, 3)} {item.baseUnit} · Materiales {formatMoney(item.materialsSubtotal, result.totals.currency)} · Mano de obra {formatMoney(item.laborSubtotal, result.totals.currency)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como se calculo</CardTitle>
          <CardDescription>Panel tecnico colapsable por componente.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {result.traces.map((trace) => (
              <AccordionItem key={trace.componentId} value={trace.componentId}>
                <AccordionTrigger>
                  <div className="flex w-full items-center justify-between pr-2">
                    <span>{trace.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Base {formatNumber(trace.baseQty, 3)} {trace.baseUnit}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <pre className="max-h-[320px] overflow-auto rounded-md bg-input p-3 text-xs">
                    {JSON.stringify(trace, null, 2)}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}


