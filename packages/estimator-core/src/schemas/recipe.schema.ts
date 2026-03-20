import { z } from 'zod';

export const recipeTypeSchema = z.enum([
  'BY_AREA',
  'BY_VOLUME',
  'BY_LENGTH',
  'BY_COUNT',
  'BY_TIME',
  'BY_FORMULA',
]);

export const roundingModeSchema = z.enum(['none', 'round', 'ceil', 'floor']);

export const recipeParamSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(2),
  unit: z.string().min(1),
  default: z.number(),
  required: z.boolean().default(true),
  help: z.string().optional(),
});

export const recipeOutputSchema = z.object({
  materialId: z.string().min(2),
  qtyExpr: z.string().min(1),
  unit: z.string().min(1),
  rounding: roundingModeSchema.default('round'),
  decimals: z.number().int().min(0).max(6).default(2),
  wastePct: z.number().min(0).max(100).optional(),
});

export const recipeSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  type: recipeTypeSchema,
  baseUnit: z.string().min(1),
  params: z.array(recipeParamSchema).default([]),
  outputs: z.array(recipeOutputSchema).min(1),
});

export const recipeListSchema = z.array(recipeSchema);

export type RecipeType = z.infer<typeof recipeTypeSchema>;
export type RoundingMode = z.infer<typeof roundingModeSchema>;
export type RecipeParam = z.infer<typeof recipeParamSchema>;
export type RecipeOutput = z.infer<typeof recipeOutputSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
