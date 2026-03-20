import { parseExpression } from "./expression/parser.js";
import { convertValue } from "./units.js";
import { Field, Material, OutputLine, Template, TemplateValidationResult } from "./types.js";

function hasDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates];
}

function validateFields(fields: Field[], errors: string[], warnings: string[]): void {
  fields.forEach((field, index) => {
    if (!field.key || !field.label) {
      errors.push(`inputs[${index}] must include key and label.`);
    }

    if (field.type === "select") {
      if (!Array.isArray(field.options) || field.options.length === 0) {
        errors.push(`inputs[${index}] type=select requires options.`);
      }
    }

    if (field.min != null && field.max != null && field.min > field.max) {
      errors.push(`inputs[${index}] has min > max.`);
    }

    if ((field.type === "number" || field.type === "int") && field.step != null && field.step <= 0) {
      warnings.push(`inputs[${index}] has non-positive step. Using free numeric input.`);
    }
  });
}

function validateMaterials(materials: Material[], errors: string[]): void {
  materials.forEach((material, index) => {
    if (!material.id || !material.name || !material.baseUnit) {
      errors.push(`materials[${index}] requires id, name and baseUnit.`);
    }
    if (material.unitCost != null && Number(material.unitCost) < 0) {
      errors.push(`materials[${index}] has negative unitCost.`);
    }
    if (material.packaging && Number(material.packaging.packSize) <= 0) {
      errors.push(`materials[${index}] packaging.packSize must be > 0.`);
    }
    if (material.packaging && material.packaging.packUnit && material.baseUnit) {
      try {
        convertValue(1, material.packaging.packUnit, material.baseUnit);
      } catch (error) {
        errors.push(
          `materials[${index}] packaging.packUnit incompatible with baseUnit: ${(error as Error).message}`
        );
      }
    }
  });
}

function validateOutputs(outputs: OutputLine[], materialsById: Map<string, Material>, errors: string[]): void {
  outputs.forEach((output, index) => {
    if (!output.id || !output.materialId || !output.qtyExpr || !output.unit) {
      errors.push(`outputs[${index}] requires id, materialId, qtyExpr and unit.`);
      return;
    }

    const material = materialsById.get(output.materialId);
    if (!material) {
      errors.push(`outputs[${index}] references unknown materialId '${output.materialId}'.`);
    } else {
      try {
        convertValue(1, output.unit, material.baseUnit);
      } catch (error) {
        errors.push(
          `outputs[${index}] unit '${output.unit}' incompatible with material '${output.materialId}' baseUnit '${material.baseUnit}': ${(error as Error).message}`
        );
      }
    }

    try {
      parseExpression(output.qtyExpr);
    } catch (error) {
      errors.push(`outputs[${index}].qtyExpr invalid: ${(error as Error).message}`);
    }
  });
}

export function validateTemplate(template: Template): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!template || typeof template !== "object") {
    return {
      ok: false,
      errors: ["Template must be an object."],
      warnings: []
    };
  }

  if (!template.id || !template.name || !template.version) {
    errors.push("Template requires id, name and version.");
  }

  if (!Array.isArray(template.inputs)) errors.push("Template.inputs must be an array.");
  if (!Array.isArray(template.computed)) errors.push("Template.computed must be an array.");
  if (!Array.isArray(template.materials)) errors.push("Template.materials must be an array.");
  if (!Array.isArray(template.rules)) errors.push("Template.rules must be an array.");
  if (!Array.isArray(template.outputs)) errors.push("Template.outputs must be an array.");

  if (errors.length) {
    return {
      ok: false,
      errors,
      warnings
    };
  }

  validateFields(template.inputs, errors, warnings);
  validateMaterials(template.materials, errors);

  const inputDuplicates = hasDuplicates(template.inputs.map((item) => item.key).filter(Boolean));
  if (inputDuplicates.length) errors.push(`Duplicate input keys: ${inputDuplicates.join(", ")}.`);

  const computedDuplicates = hasDuplicates(template.computed.map((item) => item.key).filter(Boolean));
  if (computedDuplicates.length) errors.push(`Duplicate computed keys: ${computedDuplicates.join(", ")}.`);

  const materialDuplicates = hasDuplicates(template.materials.map((item) => item.id).filter(Boolean));
  if (materialDuplicates.length) errors.push(`Duplicate material ids: ${materialDuplicates.join(", ")}.`);

  const outputDuplicates = hasDuplicates(template.outputs.map((item) => item.id).filter(Boolean));
  if (outputDuplicates.length) errors.push(`Duplicate output ids: ${outputDuplicates.join(", ")}.`);

  template.computed.forEach((item, index) => {
    if (!item.key || !item.expr) {
      errors.push(`computed[${index}] requires key and expr.`);
      return;
    }

    try {
      parseExpression(item.expr);
    } catch (error) {
      errors.push(`computed[${index}].expr invalid: ${(error as Error).message}`);
    }
  });

  template.rules.forEach((rule, ruleIndex) => {
    if (!rule.id || !rule.when) {
      errors.push(`rules[${ruleIndex}] requires id and when.`);
      return;
    }

    try {
      parseExpression(rule.when);
    } catch (error) {
      errors.push(`rules[${ruleIndex}].when invalid: ${(error as Error).message}`);
    }

    if (!Array.isArray(rule.actions)) {
      errors.push(`rules[${ruleIndex}].actions must be an array.`);
      return;
    }

    rule.actions.forEach((action, actionIndex) => {
      if (!action || typeof action !== "object" || !action.kind) {
        errors.push(`rules[${ruleIndex}].actions[${actionIndex}] is invalid.`);
      }
    });
  });

  validateOutputs(template.outputs, new Map(template.materials.map((item) => [item.id, item])), errors);

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
