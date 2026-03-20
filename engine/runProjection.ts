import { pushAudit } from "./audit.js";
import { evaluateBooleanExpression, evaluateNumberExpression } from "./expression/evaluator.js";
import { applyPackaging } from "./packaging.js";
import { fromScaled, mulScaled, roundByMode, toScaled } from "./quantity.js";
import {
  OutputCategory,
  ProjectionResult,
  ResultLine,
  RunProjectionOptions,
  Template,
  TotalsByCategory
} from "./types.js";
import { convertValue } from "./units.js";
import { validateTemplate } from "./validateTemplate.js";
import { applyWaste } from "./waste.js";

const CATEGORY_KEYS: OutputCategory[] = ["materiales", "mano_obra", "overhead", "contingencia", "otros"];

function emptyTotals(): TotalsByCategory {
  return {
    materiales: 0,
    mano_obra: 0,
    overhead: 0,
    contingencia: 0,
    otros: 0,
    grandTotal: 0
  };
}

function normalizeInputValue(raw: unknown, fieldType: string): unknown {
  if (fieldType === "boolean") {
    if (typeof raw === "boolean") return raw;
    const text = String(raw ?? "").trim().toLowerCase();
    return text === "true" || text === "1" || text === "yes";
  }

  if (fieldType === "int") {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }

  if (fieldType === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  return raw ?? "";
}

function clampNumber(value: unknown, min?: number, max?: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (typeof min === "number" && n < min) return min;
  if (typeof max === "number" && n > max) return max;
  return n;
}

function computePrecisionScore(warnings: string[], assumptions: string[]): "alta" | "media" | "baja" {
  if (warnings.length === 0 && assumptions.length <= 1) return "alta";
  if (warnings.length <= 2 && assumptions.length <= 4) return "media";
  return "baja";
}

export function runProjection(
  template: Template,
  rawInputs: Record<string, unknown>,
  options: RunProjectionOptions = {}
): ProjectionResult {
  const audit: ProjectionResult["audit"] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const totalsScaled: Record<OutputCategory | "grandTotal", number> = {
    materiales: 0,
    mano_obra: 0,
    overhead: 0,
    contingencia: 0,
    otros: 0,
    grandTotal: 0
  };

  const validation = validateTemplate(template);
  if (!validation.ok) {
    throw new Error(`Template validation failed: ${validation.errors.join(" | ")}`);
  }

  if (validation.warnings.length) {
    warnings.push(...validation.warnings);
  }

  pushAudit(audit, "template", "Template validation complete.", "info", {
    templateId: template.id,
    templateName: template.name,
    precisionMode: options.precisionMode || "balanced"
  });

  const normalizedInputs: Record<string, unknown> = {};
  for (const field of template.inputs) {
    const candidate = rawInputs[field.key] ?? field.default;

    if (field.required && (candidate === undefined || candidate === null || String(candidate).trim() === "")) {
      throw new Error(`Required input missing: ${field.label} (${field.key})`);
    }

    let value = normalizeInputValue(candidate, field.type);

    if (field.type === "number" || field.type === "int") {
      value = clampNumber(value, field.min, field.max);
    }

    normalizedInputs[field.key] = value;
  }

  pushAudit(audit, "inputs", "Inputs normalized.", "info", {
    fields: Object.keys(normalizedInputs).length
  });

  const computed: Record<string, number> = {};
  const context = {
    inputs: normalizedInputs,
    computed
  };

  for (const item of template.computed) {
    try {
      const value = evaluateNumberExpression(item.expr, context);
      computed[item.key] = value;
      pushAudit(audit, "computed", `Computed '${item.key}'.`, "info", {
        expr: item.expr,
        value
      });
    } catch (error) {
      const message = `Computed variable '${item.key}' failed: ${(error as Error).message}`;
      warnings.push(message);
      assumptions.push(`Computed '${item.key}' defaulted to 0 due to expression error.`);
      computed[item.key] = 0;
      pushAudit(audit, "computed", message, "warn", { expr: item.expr });
    }
  }

  const hiddenFields = new Set<string>();
  const shownFields = new Set<string>();
  const outputFactors = new Map<string, number>();

  for (const rule of template.rules) {
    let active = false;
    try {
      active = evaluateBooleanExpression(rule.when, context);
    } catch (error) {
      warnings.push(`Rule '${rule.id}' condition failed: ${(error as Error).message}`);
      pushAudit(audit, "rules", `Rule '${rule.id}' condition failed.`, "warn", {
        when: rule.when
      });
      continue;
    }

    if (!active) continue;

    pushAudit(audit, "rules", `Rule '${rule.id}' activated.`, "info", {
      when: rule.when,
      actionCount: rule.actions.length
    });

    for (const action of rule.actions) {
      if (action.kind === "showField") {
        shownFields.add(action.key);
        hiddenFields.delete(action.key);
      } else if (action.kind === "hideField") {
        hiddenFields.add(action.key);
        shownFields.delete(action.key);
      } else if (action.kind === "overrideComputed") {
        try {
          const value = evaluateNumberExpression(action.expr, context);
          computed[action.key] = value;
          pushAudit(audit, "rules", `overrideComputed '${action.key}' applied.`, "info", {
            expr: action.expr,
            value
          });
        } catch (error) {
          warnings.push(`Rule '${rule.id}' overrideComputed failed for '${action.key}': ${(error as Error).message}`);
          pushAudit(audit, "rules", `overrideComputed '${action.key}' failed.`, "warn", {
            expr: action.expr
          });
        }
      } else if (action.kind === "multiplyOutput") {
        const current = outputFactors.get(action.outputId) ?? 1;
        const next = current * Number(action.factor || 1);
        outputFactors.set(action.outputId, next);
      } else if (action.kind === "addWarning") {
        warnings.push(action.message);
      }
    }
  }

  const materialById = new Map(template.materials.map((material) => [material.id, material]));
  const lines: ResultLine[] = [];

  for (const output of template.outputs) {
    const material = materialById.get(output.materialId);
    if (!material) {
      warnings.push(`Output '${output.id}' skipped because material '${output.materialId}' does not exist.`);
      continue;
    }

    let qty = 0;
    try {
      qty = evaluateNumberExpression(output.qtyExpr, context);
    } catch (error) {
      warnings.push(`Output '${output.id}' qtyExpr failed: ${(error as Error).message}`);
      assumptions.push(`Output '${output.id}' quantity defaulted to 0 due to expression error.`);
      pushAudit(audit, "output", `qtyExpr failed for '${output.id}'.`, "warn", {
        expr: output.qtyExpr
      });
      qty = 0;
    }

    const factor = outputFactors.get(output.id) ?? 1;
    qty *= factor;

    if (!Number.isFinite(qty) || qty < 0) {
      assumptions.push(`Output '${output.id}' generated invalid quantity and was clamped to 0.`);
      qty = 0;
    }

    const wastePct = output.applyWaste ? Number(material.wastePct || 0) : 0;
    let qtyAfterWaste = output.applyWaste ? applyWaste(qty, wastePct, 6) : qty;

    let packagingApplied = false;
    if (output.applyPackaging && material.packaging) {
      try {
        const packaged = applyPackaging({
          quantity: qtyAfterWaste,
          quantityUnit: output.unit,
          packSize: material.packaging.packSize,
          packUnit: material.packaging.packUnit,
          rounding: output.rounding || material.rounding || "ceil"
        });
        qtyAfterWaste = packaged.adjustedQuantityInOriginalUnit;
        packagingApplied = packaged.packagingApplied;
      } catch (error) {
        warnings.push(`Packaging for output '${output.id}' failed: ${(error as Error).message}`);
      }
    }

    const roundingMode = output.rounding || material.rounding || "round";
    const finalQty = roundByMode(Math.max(0, qtyAfterWaste), roundingMode, 4);

    let qtyForCost = finalQty;
    let costUnit = material.baseUnit;
    try {
      if (output.unit !== material.baseUnit) {
        qtyForCost = convertValue(finalQty, output.unit, material.baseUnit);
      }
    } catch (error) {
      warnings.push(
        `Unit conversion failed for output '${output.id}' (${output.unit} -> ${material.baseUnit}): ${(error as Error).message}`
      );
      assumptions.push(`Cost for output '${output.id}' used quantity without conversion.`);
      qtyForCost = finalQty;
      costUnit = output.unit;
    }

    const unitCost = Number(material.unitCost || 0);
    const lineTotal = fromScaled(mulScaled(toScaled(qtyForCost), toScaled(unitCost)));

    totalsScaled[output.category] += toScaled(lineTotal);
    totalsScaled.grandTotal += toScaled(lineTotal);

    const line: ResultLine = {
      id: output.id,
      materialId: material.id,
      materialName: material.name,
      category: output.category,
      qty: finalQty,
      unit: output.unit,
      qtyForCost,
      costUnit,
      unitCost,
      lineTotal,
      sourceExpr: output.qtyExpr,
      wastePctApplied: wastePct,
      packagingApplied,
      note: output.note
    };

    lines.push(line);

    pushAudit(audit, "output", `Line '${output.id}' projected.`, "info", {
      material: material.name,
      qty: finalQty,
      lineTotal
    });
  }

  const totals: TotalsByCategory = emptyTotals();
  for (const key of CATEGORY_KEYS) {
    totals[key] = fromScaled(totalsScaled[key]);
  }
  totals.grandTotal = fromScaled(totalsScaled.grandTotal);

  pushAudit(audit, "totals", "Totals computed.", "info", {
    grandTotal: totals.grandTotal,
    lineCount: lines.length
  });

  const precisionScore = computePrecisionScore(warnings, assumptions);

  return {
    lines,
    totals,
    audit,
    warnings,
    assumptions,
    precisionScore,
    visibility: {
      hiddenFields: [...hiddenFields],
      shownFields: [...shownFields]
    },
    computed
  };
}
