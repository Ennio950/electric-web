import { Upload, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store/useAppStore';
import { downloadJson, readJsonFile } from './jsonIO';
import { useRef, useState } from 'react';

export function ImportExportPanel() {
  const exportAll = useAppStore((state) => state.exportAll);
  const importAll = useAppStore((state) => state.importAll);
  const resetToDefaults = useAppStore((state) => state.resetToDefaults);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string>('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar / Exportar</CardTitle>
        <CardDescription>Gestiona presets y respaldo completo del sistema.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => downloadJson(`uqs-backup-${Date.now()}.json`, exportAll())}
          >
            <Download className="mr-2 h-4 w-4" /> Exportar todo
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Importar todo
          </Button>
          <Button variant="outline" onClick={resetToDefaults}>
            <RefreshCw className="mr-2 h-4 w-4" /> Restaurar demos
          </Button>
        </div>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const payload = await readJsonFile(file);
              const result = importAll(payload as never);
              setMessage(result.message);
            } catch (error) {
              setMessage(`No se pudo importar: ${String((error as Error).message || error)}`);
            } finally {
              event.target.value = '';
            }
          }}
        />

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}

