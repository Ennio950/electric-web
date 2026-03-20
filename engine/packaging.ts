import { RoundMode } from "./types.js";
import { convertValue, normalizeUnit } from "./units.js";
import { roundByMode } from "./quantity.js";

export interface PackagingInput {
  quantity: number;
  quantityUnit: string;
  packSize: number;
  packUnit: string;
  rounding?: RoundMode;
}

export interface PackagingResult {
  packages: number;
  adjustedQuantityInPackUnit: number;
  adjustedQuantityInOriginalUnit: number;
  packagingApplied: boolean;
}

export function applyPackaging(input: PackagingInput): PackagingResult {
  const rawQuantity = Number(input.quantity);
  const packSize = Number(input.packSize);

  if (!Number.isFinite(rawQuantity) || rawQuantity <= 0 || !Number.isFinite(packSize) || packSize <= 0) {
    return {
      packages: 0,
      adjustedQuantityInPackUnit: 0,
      adjustedQuantityInOriginalUnit: 0,
      packagingApplied: false
    };
  }

  const quantityUnit = normalizeUnit(input.quantityUnit);
  const packUnit = normalizeUnit(input.packUnit);

  let quantityInPackUnit = rawQuantity;
  if (quantityUnit && packUnit && quantityUnit !== packUnit) {
    quantityInPackUnit = convertValue(rawQuantity, quantityUnit, packUnit);
  }

  const mode: RoundMode = input.rounding || "ceil";
  const ratio = quantityInPackUnit / packSize;

  let packages = ratio;
  if (mode === "ceil") packages = Math.ceil(ratio);
  else if (mode === "floor") packages = Math.floor(ratio);
  else packages = Math.round(ratio);

  if (packages < 0) packages = 0;

  const adjustedQuantityInPackUnit = roundByMode(packages * packSize, "round", 6);
  const adjustedQuantityInOriginalUnit =
    quantityUnit && packUnit && quantityUnit !== packUnit
      ? convertValue(adjustedQuantityInPackUnit, packUnit, quantityUnit)
      : adjustedQuantityInPackUnit;

  return {
    packages,
    adjustedQuantityInPackUnit,
    adjustedQuantityInOriginalUnit,
    packagingApplied: true
  };
}
