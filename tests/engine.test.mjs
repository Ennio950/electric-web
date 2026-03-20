import test from "node:test";
import assert from "node:assert/strict";

import {
  applyPackaging,
  applyWaste,
  convertValue,
  evaluateBooleanExpression,
  evaluateNumberExpression,
  parseExpression,
  runProjection,
  tokenize,
  validateTemplate
} from "../engine/dist/index.js";

function createTemplate() {
  return {
    id: "tpl-generic-1",
    name: "Generic Demo",
    version: "1.0.0",
    inputs: [
      { key: "length", label: "Length", type: "number", required: true, min: 0, default: 10, unit: "m" },
      { key: "width", label: "Width", type: "number", required: true, min: 0, default: 5, unit: "m" },
      { key: "enabled", label: "Enabled", type: "boolean", default: true },
      { key: "extraPct", label: "Extra", type: "number", default: 10 }
    ],
    computed: [
      { key: "area", label: "Area", unit: "m2", expr: "inputs.length * inputs.width" },
      { key: "multiplier", label: "Multiplier", expr: "1 + (inputs.extraPct / 100)" }
    ],
    materials: [
      {
        id: "mat-sheet",
        name: "Universal Sheet",
        baseUnit: "m2",
        unitCost: 8,
        wastePct: 5,
        packaging: { packSize: 2.5, packUnit: "m2" },
        rounding: "ceil"
      },
      {
        id: "mat-labor",
        name: "Labor Block",
        baseUnit: "unit",
        unitCost: 50
      }
    ],
    rules: [
      {
        id: "r-hide-width",
        when: "inputs.enabled == false",
        actions: [
          { kind: "hideField", key: "width" },
          { kind: "addWarning", message: "width hidden by rule" }
        ]
      },
      {
        id: "r-boost",
        when: "inputs.extraPct > 20",
        actions: [{ kind: "multiplyOutput", outputId: "out-sheet", factor: 1.1 }]
      }
    ],
    outputs: [
      {
        id: "out-sheet",
        materialId: "mat-sheet",
        qtyExpr: "computed.area * computed.multiplier",
        unit: "m2",
        category: "materiales",
        applyWaste: true,
        applyPackaging: true
      },
      {
        id: "out-labor",
        materialId: "mat-labor",
        qtyExpr: "max(1, computed.area / 10)",
        unit: "unit",
        category: "mano_obra"
      }
    ]
  };
}

test("tokenize: basic arithmetic", () => {
  const tokens = tokenize("inputs.length * (2 + 5)");
  assert.ok(tokens.length > 0);
  assert.equal(tokens[0].type, "identifier");
});

test("parser: generates AST", () => {
  const ast = parseExpression("1 + 2 * 3");
  assert.equal(ast.type, "BinaryExpression");
});

test("evaluator: number expression", () => {
  const value = evaluateNumberExpression("inputs.a + computed.b * 2", {
    inputs: { a: 3 },
    computed: { b: 4 }
  });
  assert.equal(value, 11);
});

test("evaluator: boolean expression", () => {
  const value = evaluateBooleanExpression("inputs.x > 3 && inputs.y < 20", {
    inputs: { x: 4, y: 10 },
    computed: {}
  });
  assert.equal(value, true);
});

test("units: length conversion m -> ft", () => {
  const value = convertValue(1, "m", "ft");
  assert.ok(Math.abs(value - 3.28084) < 0.001);
});

test("units: area conversion m2 -> ft2", () => {
  const value = convertValue(2, "m2", "ft2");
  assert.ok(Math.abs(value - 21.5278) < 0.02);
});

test("units: volume conversion L -> m3", () => {
  const value = convertValue(1000, "L", "m3");
  assert.ok(Math.abs(value - 1) < 0.0001);
});

test("units: mass conversion kg -> lb", () => {
  const value = convertValue(10, "kg", "lb");
  assert.ok(Math.abs(value - 22.0462) < 0.01);
});

test("units: incompatible conversion throws", () => {
  assert.throws(() => convertValue(1, "m", "m2"));
});

test("waste: applies percentage", () => {
  const value = applyWaste(100, 8);
  assert.equal(value, 108);
});

test("packaging: rounds up package count", () => {
  const packaged = applyPackaging({
    quantity: 6,
    quantityUnit: "m2",
    packSize: 2.5,
    packUnit: "m2",
    rounding: "ceil"
  });
  assert.equal(packaged.packages, 3);
  assert.equal(packaged.adjustedQuantityInOriginalUnit, 7.5);
});

test("packaging: floor mode", () => {
  const packaged = applyPackaging({
    quantity: 6,
    quantityUnit: "m2",
    packSize: 2.5,
    packUnit: "m2",
    rounding: "floor"
  });
  assert.equal(packaged.packages, 2);
  assert.equal(packaged.adjustedQuantityInOriginalUnit, 5);
});

test("validateTemplate: returns ok for valid template", () => {
  const result = validateTemplate(createTemplate());
  assert.equal(result.ok, true);
});

test("runProjection: returns lines totals and audit", () => {
  const result = runProjection(createTemplate(), {
    length: 12,
    width: 4,
    enabled: true,
    extraPct: 10
  });

  assert.equal(result.lines.length, 2);
  assert.ok(result.totals.grandTotal > 0);
  assert.ok(result.audit.length > 0);
  assert.ok(["alta", "media", "baja"].includes(result.precisionScore));
});

test("runProjection: applies rule warnings and visibility", () => {
  const result = runProjection(createTemplate(), {
    length: 12,
    width: 4,
    enabled: false,
    extraPct: 30
  });

  assert.ok(result.warnings.some((item) => item.includes("width hidden")));
  assert.ok(result.visibility.hiddenFields.includes("width"));
  assert.ok(result.lines[0].qty > 0);
});
