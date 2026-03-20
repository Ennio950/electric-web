import { z } from 'zod';

import { quoteComponentSchema } from './component.schema';

export const taxSchema = z.object({
  enabled: z.boolean().default(false),
  pct: z.number().min(0).max(100).default(0),
});

export const jobSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  currency: z.string().min(1),
  rootComponent: quoteComponentSchema,
  globalWastePct: z.number().min(0).max(100).default(0),
  fixedCost: z.number().nonnegative().default(0),
  tax: taxSchema.default({ enabled: false, pct: 0 }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const jobListSchema = z.array(jobSchema);

export type TaxConfig = z.infer<typeof taxSchema>;
export type Job = z.infer<typeof jobSchema>;
