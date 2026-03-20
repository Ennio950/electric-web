import type { RoundingMode } from '../schemas/recipe.schema';

export function applyRounding(
  value: number,
  mode: RoundingMode | 'none' = 'none',
  decimals = 2
): number {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeDecimals = Math.max(0, Math.floor(decimals || 0));
  const factor = 10 ** safeDecimals;

  switch (mode) {
    case 'ceil':
      return Math.ceil(safeValue * factor) / factor;
    case 'floor':
      return Math.floor(safeValue * factor) / factor;
    case 'round':
      return Math.round(safeValue * factor) / factor;
    default:
      return safeValue;
  }
}
