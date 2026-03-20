import { z } from 'zod';
import { materialCatalogSchema } from '@/schemas/material.schema';
import { recipeListSchema } from '@/schemas/recipe.schema';
import { jobListSchema } from '@/schemas/job.schema';

export const APP_STORAGE_KEY = 'universal_quote_system_v2';

export const persistedStateSchema = z.object({
  mode: z.enum(['assistant', 'expert']).default('assistant'),
  materials: materialCatalogSchema.default([]),
  recipes: recipeListSchema.default([]),
  jobs: jobListSchema.default([]),
  currentJobId: z.string().nullable().default(null),
  selectedComponentId: z.string().nullable().default(null)
});

export type PersistedState = z.infer<typeof persistedStateSchema>;

export function validatePersistedState(payload: unknown): PersistedState | null {
  const parsed = persistedStateSchema.safeParse(payload);
  if (!parsed.success) return null;
  return parsed.data;
}

