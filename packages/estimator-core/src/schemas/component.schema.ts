import { z } from 'zod';

export const measureTypeSchema = z.enum([
  'AREA',
  'VOLUME',
  'LENGTH',
  'COUNT',
  'ASSEMBLY',
  'CUSTOM_FORMULA',
  'TIME',
]);

export const componentInputSchema = z.object({
  id: z.string().min(2),
  label: z.string().min(2),
  unit: z.string().min(1),
  example: z.string().optional(),
  help: z.string().optional(),
  required: z.boolean().default(true),
});

export const componentDerivedSchema = z.object({
  id: z.string().min(2),
  label: z.string().optional(),
  unit: z.string().optional(),
  formula: z.string().min(1),
});

export const recipeBindingSchema = z.object({
  recipeId: z.string().min(2),
  enabled: z.boolean().default(true),
  paramOverrides: z.record(z.string(), z.number()).default({}),
});

export const laborModeSchema = z.enum(['NONE', 'PER_COMPONENT', 'PER_BASE_UNIT', 'PER_HOUR']);

export const componentLaborSchema = z.object({
  mode: laborModeSchema.default('NONE'),
  rate: z.number().nonnegative().default(0),
  hours: z.number().nonnegative().default(0),
});

export const componentBaseMeasureSchema = z.object({
  unit: z.string().min(1),
  expr: z.string().min(1),
});

export type MeasureType = z.infer<typeof measureTypeSchema>;
export type ComponentInput = z.infer<typeof componentInputSchema>;
export type ComponentDerived = z.infer<typeof componentDerivedSchema>;
export type RecipeBinding = z.infer<typeof recipeBindingSchema>;
export type ComponentLabor = z.infer<typeof componentLaborSchema>;

export interface QuoteComponent {
  id: string;
  name: string;
  measureType: MeasureType;
  inputs: ComponentInput[];
  inputValues: Record<string, number>;
  derived: ComponentDerived[];
  baseMeasure: z.infer<typeof componentBaseMeasureSchema>;
  recipeBindings: RecipeBinding[];
  labor: ComponentLabor;
  wastePct: number;
  children: QuoteComponent[];
}

const schemaBase: z.ZodTypeAny = z.lazy(() =>
  z.object({
    id: z.string().min(2),
    name: z.string().min(2),
    measureType: measureTypeSchema,
    inputs: z.array(componentInputSchema).default([]),
    inputValues: z.record(z.string(), z.number()).default({}),
    derived: z.array(componentDerivedSchema).default([]),
    baseMeasure: componentBaseMeasureSchema,
    recipeBindings: z.array(recipeBindingSchema).default([]),
    labor: componentLaborSchema.default({ mode: 'NONE', rate: 0, hours: 0 }),
    wastePct: z.number().min(0).max(100).default(0),
    children: z.array(schemaBase).default([]),
  }),
);

export const quoteComponentSchema = schemaBase as unknown as z.ZodType<QuoteComponent>;
