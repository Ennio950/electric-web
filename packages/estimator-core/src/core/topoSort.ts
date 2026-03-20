export type TopoNode = {
  id: string;
  dependencies: string[];
};

export type GraphNode = TopoNode;

export function topoSort(nodes: TopoNode[]): string[] {
  const map = new Map<string, { deps: Set<string>; outgoing: Set<string>; incoming: number }>();

  nodes.forEach((node) => {
    map.set(node.id, { deps: new Set(node.dependencies), outgoing: new Set(), incoming: 0 });
  });

  nodes.forEach((node) => {
    const current = map.get(node.id);
    if (!current) return;

    current.deps.forEach((depId) => {
      if (!map.has(depId) || depId === node.id) return;
      const dep = map.get(depId);
      if (!dep) return;
      dep.outgoing.add(node.id);
      current.incoming += 1;
    });
  });

  const queue: string[] = [];
  map.forEach((value, key) => {
    if (value.incoming === 0) queue.push(key);
  });

  const sorted: string[] = [];
  while (queue.length) {
    const id = queue.shift();
    if (!id) continue;
    sorted.push(id);

    const entry = map.get(id);
    if (!entry) continue;

    entry.outgoing.forEach((targetId) => {
      const target = map.get(targetId);
      if (!target) return;
      target.incoming -= 1;
      if (target.incoming === 0) queue.push(targetId);
    });
  }

  if (sorted.length !== nodes.length) {
    throw new Error('Dependencia circular detectada en formulas derivadas.');
  }

  return sorted;
}
