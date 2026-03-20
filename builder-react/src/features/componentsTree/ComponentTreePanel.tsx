import type { QuoteComponent } from '@/schemas/component.schema';
import { useAppStore, useCurrentJob } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function TreeNode({
  node,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  depth,
  rootId
}: {
  node: QuoteComponent;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  depth: number;
  rootId: string;
}) {
  const isSelected = selectedId === node.id;
  const canRemove = node.id !== rootId;

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'rounded-md border border-border bg-secondary/45 p-2',
          isSelected && 'border-primary bg-primary/20'
        )}
        style={{ marginLeft: `${depth * 14}px` }}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className="flex flex-1 items-center gap-2 text-left"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">{node.name}</p>
              <p className="text-xs text-muted-foreground">{node.measureType} · {node.baseMeasure.unit}</p>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => onAdd(node.id)} title="Agregar subparte">
              <Plus className="h-4 w-4" />
            </Button>
            {canRemove ? (
              <Button size="icon" variant="ghost" onClick={() => onRemove(node.id)} title="Eliminar parte">
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {node.children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          selectedId={selectedId}
          onSelect={onSelect}
          onAdd={onAdd}
          onRemove={onRemove}
          depth={depth + 1}
          rootId={rootId}
        />
      ))}
    </div>
  );
}

export function ComponentTreePanel() {
  const job = useCurrentJob();
  const selectedComponentId = useAppStore((state) => state.selectedComponentId);
  const setSelectedComponentId = useAppStore((state) => state.setSelectedComponentId);
  const addComponent = useAppStore((state) => state.addComponent);
  const removeComponent = useAppStore((state) => state.removeComponent);

  if (!job) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Arbol de componentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Crea o abre un trabajo para comenzar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle>Arbol de componentes</CardTitle>
          <Badge variant="secondary">LEGO</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Agrega partes y subpartes. Luego edita cada parte en el panel central.
        </p>
      </CardHeader>
      <CardContent className="space-y-2 overflow-auto scroll-slim">
        <TreeNode
          node={job.rootComponent}
          selectedId={selectedComponentId}
          onSelect={setSelectedComponentId}
          onAdd={(parentId) => addComponent(parentId, 'AREA')}
          onRemove={removeComponent}
          depth={0}
          rootId={job.rootComponent.id}
        />
      </CardContent>
    </Card>
  );
}

