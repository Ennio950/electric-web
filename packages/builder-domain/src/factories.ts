import type {
  Job,
  MaterialCatalogItem,
  MeasureType,
  QuoteComponent,
  Recipe
} from '@electric/estimator-core';

import { createComponentByMeasure } from './measurePresets';
import { uid } from './uid';

export const starterMaterials: MaterialCatalogItem[] = [
  {
    id: 'mat_material_area',
    name: 'Material por area',
    category: 'general',
    baseUnit: 'm2',
    unitPrice: 18,
    currency: 'GTQ',
    conversions: []
  },
  {
    id: 'mat_arena',
    name: 'Arena lavada',
    category: 'agregado',
    baseUnit: 'm3',
    unitPrice: 190,
    currency: 'GTQ',
    conversions: [
      { from: 'm3', to: 'ft3', factor: 35.3147 },
      { from: 'ft3', to: 'm3', factor: 0.0283168 }
    ],
    densityKgPerM3: 1600
  },
  {
    id: 'mat_conduit',
    name: 'Conduit PVC',
    category: 'electrico',
    baseUnit: 'm',
    unitPrice: 9.5,
    currency: 'GTQ',
    conversions: []
  }
];

export const starterRecipes: Recipe[] = [
  {
    id: 'rcp_area_simple',
    name: 'Consumo por area',
    description: 'Usa baseQty en m2 y un consumo por m2.',
    type: 'BY_AREA',
    baseUnit: 'm2',
    params: [
      { id: 'consumo', label: 'Consumo por m2', unit: 'unit/m2', default: 1, required: true }
    ],
    outputs: [
      { materialId: 'mat_material_area', qtyExpr: 'baseQty * consumo', unit: 'm2', rounding: 'round', decimals: 2 }
    ]
  },
  {
    id: 'rcp_volume_simple',
    name: 'Consumo por volumen',
    description: 'Usa baseQty en m3 y un factor por m3.',
    type: 'BY_VOLUME',
    baseUnit: 'm3',
    params: [
      { id: 'factor', label: 'Factor por m3', unit: 'unit/m3', default: 1, required: true }
    ],
    outputs: [
      { materialId: 'mat_arena', qtyExpr: 'baseQty * factor', unit: 'm3', rounding: 'round', decimals: 3 }
    ]
  },
  {
    id: 'rcp_length_simple',
    name: 'Consumo por longitud',
    description: 'Usa baseQty en metros.',
    type: 'BY_LENGTH',
    baseUnit: 'm',
    params: [
      { id: 'factor', label: 'Factor por metro', unit: 'unit/m', default: 1, required: true }
    ],
    outputs: [
      { materialId: 'mat_conduit', qtyExpr: 'baseQty * factor', unit: 'm', rounding: 'round', decimals: 2 }
    ]
  }
];

export function createStarterComponent(measureType: MeasureType = 'AREA'): QuoteComponent {
  const component = createComponentByMeasure(measureType);
  if (measureType === 'AREA') {
    component.recipeBindings = [{ recipeId: 'rcp_area_simple', enabled: true, paramOverrides: { consumo: 1 } }];
  }
  if (measureType === 'VOLUME') {
    component.recipeBindings = [{ recipeId: 'rcp_volume_simple', enabled: true, paramOverrides: { factor: 1 } }];
  }
  if (measureType === 'LENGTH') {
    component.recipeBindings = [{ recipeId: 'rcp_length_simple', enabled: true, paramOverrides: { factor: 1 } }];
  }
  return component;
}

export function createStarterJob(name = 'Trabajo universal base', currency = 'GTQ'): Job {
  const now = new Date().toISOString();
  return {
    id: uid('job'),
    name,
    currency,
    rootComponent: createStarterComponent('AREA'),
    globalWastePct: 3,
    fixedCost: 0,
    tax: { enabled: false, pct: 0 },
    createdAt: now,
    updatedAt: now
  };
}

export function createEmptyMaterial(currency = 'GTQ'): MaterialCatalogItem {
  return {
    id: uid('mat'),
    name: 'Material nuevo',
    category: 'general',
    baseUnit: 'unit',
    unitPrice: 0,
    currency,
    conversions: []
  };
}

export function createEmptyRecipe(): Recipe {
  return {
    id: uid('rcp'),
    name: 'Receta nueva',
    description: 'Define parametros y salidas para este consumo.',
    type: 'BY_FORMULA',
    baseUnit: 'unit',
    params: [
      { id: 'factor', label: 'Factor', unit: 'unit', default: 1, required: true }
    ],
    outputs: [
      { materialId: 'mat_material_area', qtyExpr: 'baseQty * factor', unit: 'unit', rounding: 'round', decimals: 2 }
    ]
  };
}
