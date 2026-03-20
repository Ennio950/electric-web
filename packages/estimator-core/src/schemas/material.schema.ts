import { z } from 'zod';

export const unitSchema = z.string().min(1);

export const materialConversionSchema = z.object({
  from: unitSchema,
  to: unitSchema,
  factor: z.number().positive(),
});

export const materialCatalogItemSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  category: z.string().min(2),
  baseUnit: unitSchema,
  unitPrice: z.number().nonnegative(),
  currency: z.string().min(1),
  conversions: z.array(materialConversionSchema).default([]),
  densityKgPerM3: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const materialCatalogSchema = z.array(materialCatalogItemSchema);

export type MaterialConversion = z.infer<typeof materialConversionSchema>;
export type MaterialCatalogItem = z.infer<typeof materialCatalogItemSchema>;
