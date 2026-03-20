import type { MaterialCatalogItem } from '../schemas/material.schema';

export type ConversionResult =
  | { ok: true; value: number; warning?: string }
  | { ok: false; error: string };

type UnitCategory = 'length' | 'area' | 'volume' | 'mass' | 'time' | 'count';

type UnitEntry = {
  category: UnitCategory;
  toBaseFactor: number;
};

const UNIT_MAP: Record<string, UnitEntry> = {
  mm: { category: 'length', toBaseFactor: 0.001 },
  cm: { category: 'length', toBaseFactor: 0.01 },
  m: { category: 'length', toBaseFactor: 1 },
  in: { category: 'length', toBaseFactor: 0.0254 },
  ft: { category: 'length', toBaseFactor: 0.3048 },
  yd: { category: 'length', toBaseFactor: 0.9144 },

  mm2: { category: 'area', toBaseFactor: 0.000001 },
  cm2: { category: 'area', toBaseFactor: 0.0001 },
  m2: { category: 'area', toBaseFactor: 1 },
  ft2: { category: 'area', toBaseFactor: 0.09290304 },
  yd2: { category: 'area', toBaseFactor: 0.83612736 },

  ml: { category: 'volume', toBaseFactor: 0.000001 },
  l: { category: 'volume', toBaseFactor: 0.001 },
  cm3: { category: 'volume', toBaseFactor: 0.000001 },
  m3: { category: 'volume', toBaseFactor: 1 },
  ft3: { category: 'volume', toBaseFactor: 0.0283168 },
  gal: { category: 'volume', toBaseFactor: 0.00378541 },

  g: { category: 'mass', toBaseFactor: 0.001 },
  kg: { category: 'mass', toBaseFactor: 1 },
  lb: { category: 'mass', toBaseFactor: 0.45359237 },
  oz: { category: 'mass', toBaseFactor: 0.0283495231 },
  ton: { category: 'mass', toBaseFactor: 1000 },

  h: { category: 'time', toBaseFactor: 1 },
  hr: { category: 'time', toBaseFactor: 1 },
  min: { category: 'time', toBaseFactor: 1 / 60 },
  day: { category: 'time', toBaseFactor: 24 },

  pza: { category: 'count', toBaseFactor: 1 },
  pieza: { category: 'count', toBaseFactor: 1 },
  piezas: { category: 'count', toBaseFactor: 1 },
  unit: { category: 'count', toBaseFactor: 1 },
  units: { category: 'count', toBaseFactor: 1 }
};

const UNIT_ALIASES: Record<string, string> = {
  metro: 'm',
  metros: 'm',
  centimetro: 'cm',
  centimetros: 'cm',
  milimetro: 'mm',
  milimetros: 'mm',
  litro: 'l',
  litros: 'l',
  hora: 'h',
  horas: 'h',
  unidad: 'unit',
  unidades: 'unit'
};

export function normalizeUnit(unit: string) {
  const clean = String(unit || '').trim().toLowerCase();
  if (!clean) return '';
  return UNIT_ALIASES[clean] || clean;
}

function getUnitEntry(unit: string): UnitEntry | null {
  const normalized = normalizeUnit(unit);
  return UNIT_MAP[normalized] ?? null;
}

function convertWithinCategory(value: number, fromUnit: string, toUnit: string): ConversionResult {
  const from = getUnitEntry(fromUnit);
  const to = getUnitEntry(toUnit);

  if (!from || !to) {
    return { ok: false, error: `No existe conversion conocida entre ${fromUnit} y ${toUnit}.` };
  }

  if (from.category !== to.category) {
    return { ok: false, error: `Unidades incompatibles: ${fromUnit} -> ${toUnit}.` };
  }

  const baseValue = value * from.toBaseFactor;
  return { ok: true, value: baseValue / to.toBaseFactor };
}

function tryMaterialConversion(
  value: number,
  fromUnit: string,
  toUnit: string,
  material?: MaterialCatalogItem
): ConversionResult | null {
  if (!material) return null;

  const fromNorm = normalizeUnit(fromUnit);
  const toNorm = normalizeUnit(toUnit);

  for (const conv of material.conversions || []) {
    const convFrom = normalizeUnit(conv.from);
    const convTo = normalizeUnit(conv.to);

    if (convFrom === fromNorm && convTo === toNorm) {
      return { ok: true, value: value * conv.factor };
    }

    if (convFrom === toNorm && convTo === fromNorm) {
      if (conv.factor === 0) {
        return { ok: false, error: `Conversion invalida (factor 0) entre ${fromUnit} y ${toUnit}.` };
      }
      return { ok: true, value: value / conv.factor };
    }
  }

  return null;
}

function tryDensityConversion(
  value: number,
  fromUnit: string,
  toUnit: string,
  material?: MaterialCatalogItem
): ConversionResult | null {
  if (!material?.densityKgPerM3) return null;

  const from = getUnitEntry(fromUnit);
  const to = getUnitEntry(toUnit);
  if (!from || !to) return null;

  const density = material.densityKgPerM3;
  if (!Number.isFinite(density) || density <= 0) {
    return { ok: false, error: `Densidad invalida para ${material.name}.` };
  }

  if (from.category === 'mass' && to.category === 'volume') {
    const fromInKg = convertWithinCategory(value, fromUnit, 'kg');
    if (!fromInKg.ok) return fromInKg;
    const inM3 = fromInKg.value / density;
    return convertWithinCategory(inM3, 'm3', toUnit);
  }

  if (from.category === 'volume' && to.category === 'mass') {
    const fromInM3 = convertWithinCategory(value, fromUnit, 'm3');
    if (!fromInM3.ok) return fromInM3;
    const inKg = fromInM3.value * density;
    return convertWithinCategory(inKg, 'kg', toUnit);
  }

  return null;
}

export function convertQuantity(params: {
  value: number;
  fromUnit: string;
  toUnit: string;
  material?: MaterialCatalogItem;
}): ConversionResult {
  const { value, fromUnit, toUnit, material } = params;
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return { ok: false, error: `Valor invalido para convertir: ${value}` };
  }

  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (!from || !to) {
    return { ok: false, error: 'Falta unidad origen o destino.' };
  }

  if (from === to) {
    return { ok: true, value: numeric };
  }

  const direct = convertWithinCategory(numeric, from, to);
  if (direct.ok) return direct;

  const byMaterial = tryMaterialConversion(numeric, from, to, material);
  if (byMaterial) return byMaterial;

  const byDensity = tryDensityConversion(numeric, from, to, material);
  if (byDensity) return byDensity;

  if (direct.error.includes('No existe conversion')) {
    return {
      ok: false,
      error: `No existe conversion de ${fromUnit} -> ${toUnit}. Define conversion en el material '${material?.name ?? 'N/A'}'.`
    };
  }

  if (direct.error.includes('incompatibles')) {
    return {
      ok: false,
      error: `No se puede convertir ${fromUnit} -> ${toUnit}. Si es masa/volumen agrega densidad en el material.`
    };
  }

  return direct;
}

export function parseLocaleNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim();
  if (!text) return NaN;

  const compact = text.replace(/\s+/g, '');
  const hasDot = compact.includes('.');
  const hasComma = compact.includes(',');

  let normalized = compact;
  if (hasDot && hasComma) {
    if (compact.lastIndexOf(',') > compact.lastIndexOf('.')) {
      normalized = compact.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = compact.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = compact.replace(',', '.');
  }

  return Number(normalized);
}

export function suggestDecimalsByUnit(unit: string): number {
  const normalized = normalizeUnit(unit);
  if (['pza', 'pieza', 'piezas', 'unit', 'units', 'bolsa', 'caja'].includes(normalized)) return 0;
  if (['m3', 'l', 'ft3', 'kg'].includes(normalized)) return 3;
  return 2;
}

export function knownUnits() {
  return Object.keys(UNIT_MAP);
}
