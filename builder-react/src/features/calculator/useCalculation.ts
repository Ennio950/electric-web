import { useMemo } from 'react';
import { calculateJob } from '@/core/calculator';
import { useAppStore, useCurrentJob } from '@/store/useAppStore';

export function useCalculation() {
  const job = useCurrentJob();
  const materials = useAppStore((state) => state.materials);
  const recipes = useAppStore((state) => state.recipes);

  return useMemo(() => {
    if (!job) return null;
    return calculateJob(job, materials, recipes);
  }, [job, materials, recipes]);
}

