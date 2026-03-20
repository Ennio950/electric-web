import type { QuoteComponent } from '@electric/estimator-core';

export function findComponentById(root: QuoteComponent, id: string): QuoteComponent | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findComponentById(child, id);
    if (found) return found;
  }
  return null;
}

export function updateComponentById(
  root: QuoteComponent,
  id: string,
  updater: (component: QuoteComponent) => QuoteComponent
): QuoteComponent {
  if (root.id === id) return updater(root);
  return {
    ...root,
    children: root.children.map((child) => updateComponentById(child, id, updater))
  };
}

export function addChildToComponent(root: QuoteComponent, parentId: string, childToAdd: QuoteComponent): QuoteComponent {
  if (root.id === parentId) {
    return {
      ...root,
      children: [...root.children, childToAdd]
    };
  }

  return {
    ...root,
    children: root.children.map((child) => addChildToComponent(child, parentId, childToAdd))
  };
}

export function removeComponentById(root: QuoteComponent, id: string): QuoteComponent {
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== id)
      .map((child) => removeComponentById(child, id))
  };
}
