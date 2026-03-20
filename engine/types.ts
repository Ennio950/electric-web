export type FieldType = "number" | "int" | "select" | "boolean" | "text";

export interface TemplateMeta {
  categoria?: string;
  notas?: string;
  [key: string]: unknown;
}

export interface FieldOption {
  label: string;
  value: string | number | boolean;
}

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  default?: unknown;
  options?: FieldOption[];
  section?: string;
  helpText?: string;
}

export interface ComputedVar {
  key: string;
  label: string;
  unit?: string;
  expr: string;
}

export interface MaterialPackaging {
  packSize: number;
  packUnit: string;
}

export type RoundMode = "ceil" | "floor" | "round";

export interface Material {
  id: string;
  sku?: string;
  name: string;
  baseUnit: string;
  unitCost?: number;
  packaging?: MaterialPackaging;
  wastePct?: number;
  rounding?: RoundMode;
}

export type RuleAction =
  | { kind: "showField"; key: string }
  | { kind: "hideField"; key: string }
  | { kind: "overrideComputed"; key: string; expr: string }
  | { kind: "multiplyOutput"; outputId: string; factor: number }
  | { kind: "addWarning"; message: string };

export interface Rule {
  id: string;
  when: string;
  actions: RuleAction[];
}

export type OutputCategory = "materiales" | "mano_obra" | "overhead" | "contingencia" | "otros";

export interface OutputLine {
  id: string;
  materialId: string;
  qtyExpr: string;
  unit: string;
  category: OutputCategory;
  applyWaste?: boolean;
  applyPackaging?: boolean;
  rounding?: RoundMode;
  note?: string;
}

export interface Template {
  id: string;
  name: string;
  version: string;
  meta?: TemplateMeta;
  inputs: Field[];
  computed: ComputedVar[];
  materials: Material[];
  rules: Rule[];
  outputs: OutputLine[];
}

export interface AuditStep {
  ts: string;
  level: "info" | "warn" | "error";
  stage: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface ResultLine {
  id: string;
  materialId: string;
  materialName: string;
  category: OutputCategory;
  qty: number;
  unit: string;
  qtyForCost: number;
  costUnit: string;
  unitCost: number;
  lineTotal: number;
  sourceExpr: string;
  wastePctApplied: number;
  packagingApplied: boolean;
  note?: string;
}

export interface TotalsByCategory {
  materiales: number;
  mano_obra: number;
  overhead: number;
  contingencia: number;
  otros: number;
  grandTotal: number;
}

export interface ProjectionResult {
  lines: ResultLine[];
  totals: TotalsByCategory;
  audit: AuditStep[];
  warnings: string[];
  assumptions: string[];
  precisionScore: "alta" | "media" | "baja";
  visibility: {
    hiddenFields: string[];
    shownFields: string[];
  };
  computed: Record<string, number>;
}

export interface TemplateValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface RunProjectionOptions {
  locale?: string;
  precisionMode?: "strict" | "balanced";
}
