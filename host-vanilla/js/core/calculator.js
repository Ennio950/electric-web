import { formulaEngine } from './formulaEngine.js';
import { unitSystem } from './unitSystem.js';

function deepClone(data) {
  return JSON.parse(JSON.stringify(data));
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildDefaultInputState(template) {
  const state = {};
  (template.inputs || []).forEach((field) => {
    const defaultValue = field.default ?? (field.type === 'number' ? 0 : '');
    state[field.id] = {
      value: String(defaultValue),
      unit: field.unit || ''
    };
  });
  return state;
}

function applyDemoValues(template, currentState = null) {
  const base = currentState ? deepClone(currentState) : buildDefaultInputState(template);

  (template.inputs || []).forEach((field) => {
    if (!base[field.id]) {
      base[field.id] = { value: '', unit: field.unit || '' };
    }

    if (field.type === 'number') {
      const min = toNumber(field.min, 0);
      const max = Number.isFinite(Number(field.max)) ? Number(field.max) : min + 100;
      const def = Number.isFinite(Number(field.default)) ? Number(field.default) : min + (max - min) * 0.35;
      const noise = Math.random() * 0.25 + 0.9;
      const value = Math.max(min, Math.min(max, def * noise));
      const digits = field.step && String(field.step).includes('.') ? String(field.step).split('.')[1].length : 2;
      base[field.id].value = value.toFixed(Math.min(4, digits));
      base[field.id].unit = base[field.id].unit || field.unit || '';
      return;
    }

    if (field.type === 'select' && Array.isArray(field.options) && field.options.length) {
      const first = field.options[0];
      base[field.id].value = typeof first === 'object' ? String(first.value) : String(first);
      return;
    }

    if (field.type === 'text') {
      base[field.id].value = field.default ? String(field.default) : 'Demo';
    }
  });

  return base;
}

function resolveSelectValue(option) {
  if (typeof option === 'object' && option) {
    return {
      value: String(option.value ?? ''),
      label: String(option.label ?? option.value ?? '')
    };
  }
  return {
    value: String(option ?? ''),
    label: String(option ?? '')
  };
}

function normalizeInputs(template, inputState) {
  const normalized = {};
  const errors = [];
  const warnings = [];

  (template.inputs || []).forEach((field) => {
    const rawEntry = inputState?.[field.id] || {};
    const rawValue = rawEntry.value ?? '';

    if (field.type === 'number') {
      const numeric = unitSystem.parseLocaleNumber(rawValue);
      if (!Number.isFinite(numeric)) {
        if (field.required) {
          errors.push(`Campo requerido: ${field.label}.`);
          return;
        }
        normalized[field.id] = 0;
        return;
      }

      const selectedUnit = rawEntry.unit || field.unit;
      let normalizedValue = numeric;

      if (selectedUnit && field.unit) {
        try {
          normalizedValue = unitSystem.convert(numeric, selectedUnit, field.unit);
        } catch {
          warnings.push(`No se pudo convertir unidad en ${field.label}. Se uso valor directo.`);
          normalizedValue = numeric;
        }
      }

      if (Number.isFinite(Number(field.min)) && normalizedValue < Number(field.min)) {
        errors.push(`${field.label} debe ser >= ${field.min}.`);
      }
      if (Number.isFinite(Number(field.max)) && normalizedValue > Number(field.max)) {
        errors.push(`${field.label} debe ser <= ${field.max}.`);
      }

      normalized[field.id] = normalizedValue;
      return;
    }

    if (field.type === 'select') {
      const selected = String(rawValue || field.default || '');
      if (field.required && !selected) {
        errors.push(`Campo requerido: ${field.label}.`);
      }

      if (Array.isArray(field.options) && field.options.length) {
        const optionValues = field.options.map((option) => resolveSelectValue(option).value);
        if (selected && !optionValues.includes(selected)) {
          errors.push(`${field.label} tiene una opcion invalida.`);
        }
      }

      normalized[field.id] = selected;
      return;
    }

    const textValue = String(rawValue || field.default || '').trim();
    if (field.required && !textValue) {
      errors.push(`Campo requerido: ${field.label}.`);
    }
    normalized[field.id] = textValue;
  });

  return {
    normalized,
    errors,
    warnings
  };
}

function applyRounding(value, rounding = 'none', precision = 2) {
  const digits = Math.max(0, Number(precision) || 0);
  const factor = 10 ** digits;

  if (rounding === 'ceil') return Math.ceil(value * factor) / factor;
  if (rounding === 'round') return Math.round(value * factor) / factor;
  if (rounding === 'floor') return Math.floor(value * factor) / factor;
  return value;
}

function evaluateWastePercent(material, scope) {
  if (typeof material.wastePct === 'number') return material.wastePct;
  if (typeof material.wastePct === 'string' && material.wastePct.trim()) {
    return formulaEngine.evaluateExpression(material.wastePct, scope);
  }
  return 0;
}

function buildScope(inputs, derived = {}, extra = {}) {
  return {
    ...inputs,
    ...derived,
    ...extra,
    inputs,
    derived
  };
}

function safeValueFromScope(scope, id, fallback = 0) {
  if (!id) return fallback;
  if (Object.prototype.hasOwnProperty.call(scope, id)) {
    const value = Number(scope[id]);
    return Number.isFinite(value) ? value : fallback;
  }
  return fallback;
}

function calculate(template, inputState) {
  const validation = normalizeInputs(template, inputState);
  const errors = [...validation.errors];
  const warnings = [...validation.warnings];

  if (errors.length) {
    return {
      ok: false,
      errors,
      warnings,
      normalizedInputs: validation.normalized,
      derived: {},
      materials: [],
      totals: null,
      technical: null,
      model3d: null
    };
  }

  const inputs = validation.normalized;
  const baseScope = buildScope(inputs, {}, {});

  let derivedValues = {};
  let orderedDerived = [];
  try {
    const derivedResult = formulaEngine.evaluateDerivedList(template.derived || [], baseScope);
    derivedValues = derivedResult.derivedValues;
    orderedDerived = derivedResult.ordered;
  } catch (error) {
    errors.push(`Error en formulas derivadas: ${String(error.message || error)}`);
    return {
      ok: false,
      errors,
      warnings,
      normalizedInputs: inputs,
      derived: {},
      materials: [],
      totals: null,
      technical: null,
      model3d: null
    };
  }

  const fullScope = buildScope(inputs, derivedValues, {});
  const materials = [];

  (template.materials || []).forEach((material) => {
    try {
      const qtyBase = formulaEngine.evaluateExpression(material.qtyFormula || '0', fullScope);
      const wastePct = evaluateWastePercent(material, fullScope);
      const wasteFactor = 1 + Math.max(0, wastePct) / 100;
      const qtyWithWaste = qtyBase * wasteFactor;

      const precision = Number.isFinite(Number(material.precision))
        ? Number(material.precision)
        : unitSystem.suggestPrecisionByUnit(material.unit);

      const rounding = material.rounding || 'none';
      const qtyFinal = applyRounding(Math.max(0, qtyWithWaste), rounding, precision);

      const unitCostRaw = material.unitCostInputId
        ? safeValueFromScope(fullScope, material.unitCostInputId, material.defaultUnitCost || 0)
        : Number(material.defaultUnitCost || 0);

      const unitCost = Number.isFinite(unitCostRaw) ? unitCostRaw : 0;
      const subtotal = applyRounding(qtyFinal * unitCost, 'round', 2);

      materials.push({
        id: material.id,
        name: material.name,
        unit: material.unit || 'unit',
        rounding,
        precision,
        wastePct: applyRounding(wastePct, 'round', 2),
        qtyBase: applyRounding(qtyBase, 'round', Math.max(2, precision)),
        qtyFinal,
        unitCost,
        subtotal,
        formula: material.qtyFormula,
        help: material.help || ''
      });
    } catch (error) {
      errors.push(`Error en material '${material.name || material.id}': ${String(error.message || error)}`);
    }
  });

  if (errors.length) {
    return {
      ok: false,
      errors,
      warnings,
      normalizedInputs: inputs,
      derived: derivedValues,
      materials,
      totals: null,
      technical: null,
      model3d: null
    };
  }

  const materialsSubtotal = materials.reduce((sum, item) => sum + item.subtotal, 0);
  const summary = template.summary || {};

  const labor = summary.includeLabor
    ? safeValueFromScope(fullScope, summary.laborInputId, Number(summary.defaultLabor || 0))
    : 0;

  const fixedCost = summary.includeFixedCost
    ? safeValueFromScope(fullScope, summary.fixedCostInputId, Number(summary.defaultFixedCost || 0))
    : 0;

  const taxPct = summary.includeTax
    ? safeValueFromScope(fullScope, summary.taxPctInputId, Number(summary.defaultTaxPct || 0))
    : 0;

  const subtotalBeforeTax = applyRounding(materialsSubtotal + labor + fixedCost, 'round', 2);
  const taxAmount = summary.includeTax
    ? applyRounding(subtotalBeforeTax * (Math.max(0, taxPct) / 100), 'round', 2)
    : 0;

  const grandTotal = applyRounding(subtotalBeforeTax + taxAmount, 'round', 2);

  const costPerBase = summary.costPerDerivedId
    ? safeValueFromScope({ ...fullScope, ...derivedValues }, summary.costPerDerivedId, 0)
    : safeValueFromScope(fullScope, summary.costPerInputId, 0);

  const costPerUnit = costPerBase > 0
    ? applyRounding(grandTotal / costPerBase, 'round', 2)
    : null;

  const model3d = template['3d']?.enabled
    ? {
        enabled: true,
        x: safeValueFromScope({ ...fullScope, ...derivedValues }, template['3d']?.dims?.xId, 1),
        y: safeValueFromScope({ ...fullScope, ...derivedValues }, template['3d']?.dims?.yId, 1),
        z: safeValueFromScope({ ...fullScope, ...derivedValues }, template['3d']?.dims?.zId, 1),
        labels: template['3d']?.labels || { x: 'X', y: 'Y', z: 'Z' }
      }
    : null;

  const technical = {
    derived: orderedDerived.map((item) => ({
      id: item.id,
      formula: item.formula,
      value: derivedValues[item.id],
      unit: item.unit || ''
    })),
    materials: materials.map((item) => ({
      id: item.id,
      formula: item.formula,
      qtyBase: item.qtyBase,
      wastePct: item.wastePct,
      qtyFinal: item.qtyFinal,
      unit: item.unit,
      unitCost: item.unitCost,
      subtotal: item.subtotal
    })),
    normalizedInputs: inputs
  };

  return {
    ok: true,
    errors,
    warnings,
    normalizedInputs: inputs,
    derived: derivedValues,
    materials,
    totals: {
      currency: template.currency || 'Q',
      materialsSubtotal: applyRounding(materialsSubtotal, 'round', 2),
      labor: applyRounding(labor, 'round', 2),
      fixedCost: applyRounding(fixedCost, 'round', 2),
      subtotalBeforeTax,
      taxPct: applyRounding(taxPct, 'round', 2),
      taxAmount,
      grandTotal,
      costPerBase,
      costPerUnit
    },
    technical,
    model3d
  };
}

function normalizeTemplate(template) {
  if (!template || typeof template !== 'object') {
    throw new Error('Plantilla invalida.');
  }
  if (!template.templateId || !template.name) {
    throw new Error('La plantilla requiere templateId y name.');
  }

  const safeTemplate = {
    templateId: String(template.templateId),
    name: String(template.name),
    version: String(template.version || '1.0.0'),
    currency: String(template.currency || 'Q'),
    description: String(template.description || ''),
    inputs: Array.isArray(template.inputs) ? template.inputs : [],
    derived: Array.isArray(template.derived) ? template.derived : [],
    materials: Array.isArray(template.materials) ? template.materials : [],
    summary: template.summary || {},
    '3d': template['3d'] || { enabled: false, dims: {} }
  };

  return safeTemplate;
}

export const calculator = {
  normalizeTemplate,
  buildDefaultInputState,
  applyDemoValues,
  normalizeInputs,
  calculate
};
