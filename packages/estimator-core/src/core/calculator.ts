import type { QuoteComponent } from '../schemas/component.schema';
import type { Job } from '../schemas/job.schema';
import type { MaterialCatalogItem } from '../schemas/material.schema';
import type { Recipe } from '../schemas/recipe.schema';
import { applyRounding } from './rounding';
import { evaluateDerivedList, evaluateExpression } from './safeFormulaEngine';
import { convertQuantity, suggestDecimalsByUnit } from './unitSystem';

export type MaterialResultLine = {
  materialId: string;
  materialName: string;
  unit: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
};

export type ComponentBreakdown = {
  componentId: string;
  name: string;
  depth: number;
  baseQty: number;
  baseUnit: string;
  materialsSubtotal: number;
  laborSubtotal: number;
  total: number;
};

export type CalculationTrace = {
  componentId: string;
  name: string;
  baseQty: number;
  baseUnit: string;
  inputs: Record<string, number>;
  derived: Array<{ id: string; formula: string; value: number }>;
  recipeRuns: Array<{
    recipeId: string;
    recipeName: string;
    params: Record<string, number>;
    outputs: Array<{
      materialId: string;
      qtyRaw: number;
      qtyAfterWaste: number;
      qtyConverted: number;
      outputUnit: string;
      materialBaseUnit: string;
      subtotal: number;
      formula: string;
    }>;
  }>;
  labor: { mode: string; cost: number };
};

export type CalculationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  materials: MaterialResultLine[];
  componentBreakdown: ComponentBreakdown[];
  traces: CalculationTrace[];
  totals: {
    currency: string;
    materialsSubtotal: number;
    laborSubtotal: number;
    fixedCost: number;
    taxPct: number;
    taxAmount: number;
    grandTotal: number;
    costPerUnit: number | null;
    unitLabel: string;
  };
};

type EvalContext = {
  job: Job;
  materialsMap: Map<string, MaterialCatalogItem>;
  recipesMap: Map<string, Recipe>;
  errors: string[];
  warnings: string[];
  aggregate: Map<string, MaterialResultLine>;
  traces: CalculationTrace[];
  breakdown: ComponentBreakdown[];
  laborTotal: number;
};

function safeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getRecipeParamValue(recipe: Recipe, paramId: string, overrideMap: Record<string, number>) {
  if (Object.prototype.hasOwnProperty.call(overrideMap, paramId)) {
    return safeNumber(overrideMap[paramId], 0);
  }
  const param = recipe.params.find((item) => item.id === paramId);
  return safeNumber(param?.default ?? 0, 0);
}

function evaluateLabor(component: QuoteComponent, baseQty: number) {
  const labor = component.labor;
  if (!labor || labor.mode === 'NONE') return 0;

  const rate = safeNumber(labor.rate, 0);
  const hours = safeNumber(labor.hours, 0);

  if (labor.mode === 'PER_COMPONENT') return rate;
  if (labor.mode === 'PER_BASE_UNIT') return rate * Math.max(baseQty, 0);
  if (labor.mode === 'PER_HOUR') return rate * Math.max(hours, 0);
  return 0;
}

function addMaterialLine(aggregate: Map<string, MaterialResultLine>, line: MaterialResultLine) {
  const existing = aggregate.get(line.materialId);
  if (!existing) {
    aggregate.set(line.materialId, { ...line });
    return;
  }

  existing.qty += line.qty;
  existing.subtotal += line.subtotal;
}

function evaluateComponent(
  component: QuoteComponent,
  ctx: EvalContext,
  depth = 0
): { baseQty: number; baseUnit: string; materialSubtotal: number; laborSubtotal: number; total: number } {
  const inputScope: Record<string, number> = {};

  component.inputs.forEach((input) => {
    const raw = component.inputValues[input.id];
    const value = safeNumber(raw, 0);
    if (input.required && !Number.isFinite(raw as number)) {
      ctx.errors.push(`Falta dato en '${component.name}': ${input.label}.`);
    }
    inputScope[input.id] = value;
  });

  let derivedValues: Record<string, number> = {};
  let orderedDerived: Array<{ id: string; formula: string }> = [];
  try {
    const derivedEval = evaluateDerivedList(
      component.derived.map((item) => ({ id: item.id, formula: item.formula })),
      inputScope
    );
    derivedValues = derivedEval.values;
    orderedDerived = derivedEval.ordered;
  } catch (error) {
    ctx.errors.push(`Error en formulas derivadas de '${component.name}': ${String((error as Error).message || error)}`);
  }

  const baseScope = {
    ...inputScope,
    ...derivedValues,
    inputs: inputScope,
    derived: derivedValues
  };

  let baseQty = 0;
  try {
    baseQty = evaluateExpression(component.baseMeasure.expr, baseScope);
  } catch (error) {
    ctx.errors.push(`Error en medida base de '${component.name}': ${String((error as Error).message || error)}`);
  }

  if (!Number.isFinite(baseQty) || baseQty < 0) {
    ctx.errors.push(`Medida base invalida en '${component.name}'.`);
    baseQty = 0;
  }

  const trace: CalculationTrace = {
    componentId: component.id,
    name: component.name,
    baseQty,
    baseUnit: component.baseMeasure.unit,
    inputs: { ...inputScope },
    derived: orderedDerived.map((item) => ({
      id: item.id,
      formula: item.formula,
      value: derivedValues[item.id] ?? 0
    })),
    recipeRuns: [],
    labor: { mode: component.labor.mode, cost: 0 }
  };

  let ownMaterialsSubtotal = 0;

  component.recipeBindings
    .filter((binding) => binding.enabled)
    .forEach((binding) => {
      const recipe = ctx.recipesMap.get(binding.recipeId);
      if (!recipe) {
        ctx.errors.push(`No existe receta '${binding.recipeId}' en componente '${component.name}'.`);
        return;
      }

      const paramsScope: Record<string, number> = {};
      recipe.params.forEach((param) => {
        paramsScope[param.id] = getRecipeParamValue(recipe, param.id, binding.paramOverrides || {});
      });

      const runTrace: CalculationTrace['recipeRuns'][number] = {
        recipeId: recipe.id,
        recipeName: recipe.name,
        params: { ...paramsScope },
        outputs: []
      };

      recipe.outputs.forEach((output) => {
        const material = ctx.materialsMap.get(output.materialId);
        if (!material) {
          ctx.errors.push(`No existe material '${output.materialId}' en receta '${recipe.name}'.`);
          return;
        }

        const scope = {
          ...baseScope,
          ...paramsScope,
          baseQty,
          params: paramsScope
        };

        let qtyRaw = 0;
        try {
          qtyRaw = evaluateExpression(output.qtyExpr, scope);
        } catch (error) {
          ctx.errors.push(
            `Error en qtyExpr (${recipe.name} -> ${material.name}): ${String((error as Error).message || error)}`
          );
          return;
        }

        if (!Number.isFinite(qtyRaw)) {
          ctx.errors.push(`Cantidad invalida para '${material.name}' en componente '${component.name}'.`);
          return;
        }

        const outputWaste = safeNumber(output.wastePct, 0);
        const componentWaste = safeNumber(component.wastePct, 0);
        const globalWaste = safeNumber(ctx.job.globalWastePct, 0);

        const qtyAfterWaste = Math.max(
          0,
          qtyRaw
            * (1 + outputWaste / 100)
            * (1 + componentWaste / 100)
            * (1 + globalWaste / 100)
        );

        const decimals = Number.isFinite(output.decimals) ? output.decimals : suggestDecimalsByUnit(output.unit);
        const roundedQty = applyRounding(qtyAfterWaste, output.rounding, decimals);

        const conversion = convertQuantity({
          value: roundedQty,
          fromUnit: output.unit,
          toUnit: material.baseUnit,
          material
        });

        if (!conversion.ok) {
          ctx.errors.push(`Conversion fallida (${material.name}): ${conversion.error}`);
          return;
        }

        const qtyInBaseUnit = conversion.value;
        const unitPrice = safeNumber(material.unitPrice, 0);
        if (unitPrice <= 0) {
          ctx.errors.push(`Falta precio del material '${material.name}'.`);
          return;
        }

        const subtotal = qtyInBaseUnit * unitPrice;
        ownMaterialsSubtotal += subtotal;

        addMaterialLine(ctx.aggregate, {
          materialId: material.id,
          materialName: material.name,
          qty: qtyInBaseUnit,
          unit: material.baseUnit,
          unitPrice,
          subtotal
        });

        runTrace.outputs.push({
          materialId: material.id,
          qtyRaw,
          qtyAfterWaste: roundedQty,
          qtyConverted: qtyInBaseUnit,
          outputUnit: output.unit,
          materialBaseUnit: material.baseUnit,
          subtotal,
          formula: output.qtyExpr
        });
      });

      trace.recipeRuns.push(runTrace);
    });

  const ownLabor = evaluateLabor(component, baseQty);
  trace.labor.cost = ownLabor;
  ctx.laborTotal += ownLabor;

  let childrenTotal = 0;
  component.children.forEach((child) => {
    const childResult = evaluateComponent(child, ctx, depth + 1);
    childrenTotal += childResult.total;
  });

  const total = ownMaterialsSubtotal + ownLabor + childrenTotal;

  ctx.breakdown.push({
    componentId: component.id,
    name: component.name,
    depth,
    baseQty,
    baseUnit: component.baseMeasure.unit,
    materialsSubtotal: ownMaterialsSubtotal,
    laborSubtotal: ownLabor,
    total
  });

  ctx.traces.push(trace);

  return {
    baseQty,
    baseUnit: component.baseMeasure.unit,
    materialSubtotal: ownMaterialsSubtotal,
    laborSubtotal: ownLabor,
    total
  };
}

export function calculateJob(
  job: Job,
  materials: MaterialCatalogItem[],
  recipes: Recipe[]
): CalculationResult {
  const ctx: EvalContext = {
    job,
    materialsMap: new Map(materials.map((material) => [material.id, material])),
    recipesMap: new Map(recipes.map((recipe) => [recipe.id, recipe])),
    errors: [],
    warnings: [],
    aggregate: new Map(),
    traces: [],
    breakdown: [],
    laborTotal: 0
  };

  const rootResult = evaluateComponent(job.rootComponent, ctx, 0);

  const materialLines = Array.from(ctx.aggregate.values()).map((line) => ({
    ...line,
    qty: applyRounding(line.qty, 'round', suggestDecimalsByUnit(line.unit)),
    subtotal: applyRounding(line.subtotal, 'round', 2)
  }));

  const materialsSubtotal = materialLines.reduce((sum, line) => sum + line.subtotal, 0);
  const fixedCost = safeNumber(job.fixedCost, 0);
  const subtotalBeforeTax = materialsSubtotal + ctx.laborTotal + fixedCost;
  const taxPct = job.tax.enabled ? safeNumber(job.tax.pct, 0) : 0;
  const taxAmount = applyRounding(subtotalBeforeTax * (taxPct / 100), 'round', 2);
  const grandTotal = applyRounding(subtotalBeforeTax + taxAmount, 'round', 2);

  const costPerUnit = rootResult.baseQty > 0
    ? applyRounding(grandTotal / rootResult.baseQty, 'round', 2)
    : null;

  return {
    ok: ctx.errors.length === 0,
    errors: ctx.errors,
    warnings: ctx.warnings,
    materials: materialLines,
    componentBreakdown: ctx.breakdown.sort((a, b) => a.depth - b.depth),
    traces: ctx.traces,
    totals: {
      currency: job.currency,
      materialsSubtotal: applyRounding(materialsSubtotal, 'round', 2),
      laborSubtotal: applyRounding(ctx.laborTotal, 'round', 2),
      fixedCost: applyRounding(fixedCost, 'round', 2),
      taxPct: applyRounding(taxPct, 'round', 2),
      taxAmount,
      grandTotal,
      costPerUnit,
      unitLabel: rootResult.baseUnit
    }
  };
}
