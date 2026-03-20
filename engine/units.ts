import { fromScaled, mulScaled, toScaled } from "./quantity.js";

export type UnitDimension = "length" | "area" | "volume" | "mass" | "unit";

interface UnitDef {
  dimension: UnitDimension;
  toBase: number;
}

const UNIT_DEFS: Record<string, UnitDef> = {
  // length base: mm
  mm: { dimension: "length", toBase: 1 },
  cm: { dimension: "length", toBase: 10 },
  m: { dimension: "length", toBase: 1000 },
  in: { dimension: "length", toBase: 25.4 },
  ft: { dimension: "length", toBase: 304.8 },

  // area base: mm2
  mm2: { dimension: "area", toBase: 1 },
  cm2: { dimension: "area", toBase: 100 },
  m2: { dimension: "area", toBase: 1000000 },
  in2: { dimension: "area", toBase: 645.16 },
  ft2: { dimension: "area", toBase: 92903.04 },

  // volume base: mm3
  mm3: { dimension: "volume", toBase: 1 },
  cm3: { dimension: "volume", toBase: 1000 },
  m3: { dimension: "volume", toBase: 1000000000 },
  in3: { dimension: "volume", toBase: 16387.064 },
  ft3: { dimension: "volume", toBase: 28316846.592 },
  l: { dimension: "volume", toBase: 1000000 },

  // mass base: g
  g: { dimension: "mass", toBase: 1 },
  kg: { dimension: "mass", toBase: 1000 },
  lb: { dimension: "mass", toBase: 453.59237 },

  // generic units
  pcs: { dimension: "unit", toBase: 1 },
  unit: { dimension: "unit", toBase: 1 },
  lot: { dimension: "unit", toBase: 1 }
};

export function normalizeUnit(unit?: string): string {
  return String(unit || "").trim().toLowerCase();
}

export function getUnitDef(unit?: string): UnitDef | null {
  const normalized = normalizeUnit(unit);
  if (!normalized) return null;
  return UNIT_DEFS[normalized] ?? null;
}

export function areUnitsCompatible(from?: string, to?: string): boolean {
  const a = getUnitDef(from);
  const b = getUnitDef(to);
  if (!a || !b) return false;
  return a.dimension === b.dimension;
}

export function assertCompatibleUnits(from?: string, to?: string): void {
  if (!areUnitsCompatible(from, to)) {
    throw new Error(`Incompatible units: ${String(from || "?")} and ${String(to || "?")}`);
  }
}

export function convertValue(value: number, fromUnit?: string, toUnit?: string): number {
  const from = getUnitDef(fromUnit);
  const to = getUnitDef(toUnit);

  if (!from || !to) {
    if (normalizeUnit(fromUnit) === normalizeUnit(toUnit)) return value;
    throw new Error(`Unknown unit conversion: ${String(fromUnit || "?")} -> ${String(toUnit || "?")}`);
  }

  if (from.dimension !== to.dimension) {
    throw new Error(`Dimension mismatch: ${from.dimension} vs ${to.dimension}`);
  }

  const asScaled = toScaled(value);
  const toBaseRatio = toScaled(from.toBase);
  const baseScaled = mulScaled(asScaled, toBaseRatio);
  const fromBaseRatio = toScaled(to.toBase);
  return fromScaled(Math.round((baseScaled * toScaled(1)) / fromBaseRatio));
}

export function getUnitDimension(unit?: string): UnitDimension | null {
  return getUnitDef(unit)?.dimension ?? null;
}
