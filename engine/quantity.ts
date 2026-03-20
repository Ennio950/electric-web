export const DECIMAL_SCALE = 10000;

export type Scaled = number;

export function toScaled(value: number | string, scale = DECIMAL_SCALE): Scaled {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * scale);
}

export function fromScaled(value: Scaled, scale = DECIMAL_SCALE): number {
  return value / scale;
}

export function addScaled(a: Scaled, b: Scaled): Scaled {
  return a + b;
}

export function subScaled(a: Scaled, b: Scaled): Scaled {
  return a - b;
}

export function mulScaled(a: Scaled, b: Scaled, scale = DECIMAL_SCALE): Scaled {
  return Math.round((a * b) / scale);
}

export function divScaled(a: Scaled, b: Scaled, scale = DECIMAL_SCALE): Scaled {
  if (b === 0) {
    throw new Error("Division by zero in scaled math.");
  }
  return Math.round((a * scale) / b);
}

export function toCurrency(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

export function roundByMode(value: number, mode: "ceil" | "floor" | "round" = "round", digits = 4): number {
  const factor = 10 ** digits;
  if (mode === "ceil") return Math.ceil(value * factor) / factor;
  if (mode === "floor") return Math.floor(value * factor) / factor;
  return Math.round(value * factor) / factor;
}

export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  return numerator / denominator;
}

export function sumScaled(values: number[], scale = DECIMAL_SCALE): number {
  return values.reduce((acc, value) => addScaled(acc, toScaled(value, scale)), 0);
}

export function fromPercent(percent: number): number {
  const n = Number(percent);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}
