import { fromPercent, roundByMode } from "./quantity.js";

export function applyWaste(quantity: number, wastePct = 0, digits = 4): number {
  const q = Number(quantity);
  if (!Number.isFinite(q) || q <= 0) return 0;
  const factor = 1 + fromPercent(Number(wastePct) || 0);
  return roundByMode(q * factor, "round", digits);
}
