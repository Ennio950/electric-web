import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import defaultMaterials from '@/data/defaultMaterials.json';
import defaultRecipes from '@/data/defaultRecipes.json';
import defaultPresets from '@/data/defaultPresets.json';
import type { Job } from '@/schemas/job.schema';
import { jobSchema } from '@/schemas/job.schema';
import type { MaterialCatalogItem } from '@/schemas/material.schema';
import { materialCatalogItemSchema } from '@/schemas/material.schema';
import type { QuoteComponent, MeasureType } from '@/schemas/component.schema';
import { quoteComponentSchema } from '@/schemas/component.schema';
import type { Recipe } from '@/schemas/recipe.schema';
import { recipeSchema } from '@/schemas/recipe.schema';
import { uid } from '@/lib/utils';
import { APP_STORAGE_KEY, validatePersistedState } from './persist';
import { addChildToComponent, findComponentById, removeComponentById, updateComponentById } from '@/features/componentsTree/treeUtils';
import { createComponentByMeasure } from '@/features/componentsTree/measurePresets';

export type AppMode = 'assistant' | 'expert';

type ImportPayload = {
  materials?: MaterialCatalogItem[];
  recipes?: Recipe[];
  jobs?: Job[];
  mode?: AppMode;
};

const LEGACY_AREA_MATERIAL_ID = 'mat_geotextil';
const AREA_MATERIAL_ID = 'mat_material_area';

function normalizeLegacyMaterials(materials: MaterialCatalogItem[]): MaterialCatalogItem[] {
  const normalized = materials.map((material) => {
    if (material.id !== LEGACY_AREA_MATERIAL_ID) return material;
    return {
      ...material,
      id: AREA_MATERIAL_ID,
      name: 'Material por area'
    };
  });

  return Array.from(new Map(normalized.map((material) => [material.id, material])).values());
}

function normalizeLegacyRecipes(recipes: Recipe[]): Recipe[] {
  return recipes.map((recipe) => ({
    ...recipe,
    outputs: recipe.outputs.map((output) => ({
      ...output,
      materialId: output.materialId === LEGACY_AREA_MATERIAL_ID ? AREA_MATERIAL_ID : output.materialId
    }))
  }));
}

type AppState = {
  mode: AppMode;
  materials: MaterialCatalogItem[];
  recipes: Recipe[];
  jobs: Job[];
  currentJobId: string | null;
  selectedComponentId: string | null;
  setMode: (mode: AppMode) => void;
  resetToDefaults: () => void;
  createJob: (name: string, currency: string) => Job;
  setCurrentJobId: (jobId: string | null) => void;
  deleteJob: (jobId: string) => void;
  updateCurrentJobMeta: (patch: Partial<Pick<Job, 'name' | 'currency' | 'globalWastePct' | 'fixedCost' | 'tax'>>) => void;
  setSelectedComponentId: (componentId: string | null) => void;
  addComponent: (parentComponentId: string, measureType: MeasureType) => void;
  removeComponent: (componentId: string) => void;
  updateComponent: (componentId: string, updater: (component: QuoteComponent) => QuoteComponent) => void;
  saveMaterial: (material: MaterialCatalogItem) => void;
  removeMaterial: (materialId: string) => void;
  saveRecipe: (recipe: Recipe) => void;
  removeRecipe: (recipeId: string) => void;
  importAll: (payload: ImportPayload) => { ok: boolean; message: string };
  exportAll: () => ImportPayload;
};

function nowIso() {
  return new Date().toISOString();
}

function toValidMaterial(raw: unknown): MaterialCatalogItem {
  const parsed = materialCatalogItemSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}

function toValidRecipe(raw: unknown): Recipe {
  const parsed = recipeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}

function toValidComponent(raw: unknown): QuoteComponent {
  const parsed = quoteComponentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}

function toValidJob(raw: unknown): Job {
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}

function collectValidDefaults<T>(rows: unknown, parser: (raw: unknown) => T, label: string): T[] {
  if (!Array.isArray(rows)) return [];

  const output: T[] = [];
  rows.forEach((row, index) => {
    try {
      output.push(parser(row));
    } catch (error) {
      console.warn(`[store] ${label} invalido en indice ${index}.`, error);
    }
  });
  return output;
}

function ensureCurrentSelection(state: AppState): Pick<AppState, 'currentJobId' | 'selectedComponentId'> {
  if (!state.jobs.length) return { currentJobId: null, selectedComponentId: null };

  const current = state.jobs.find((job) => job.id === state.currentJobId) ?? state.jobs[0];
  const selected = state.selectedComponentId && findComponentById(current.rootComponent, state.selectedComponentId)
    ? state.selectedComponentId
    : current.rootComponent.id;

  return {
    currentJobId: current.id,
    selectedComponentId: selected
  };
}

function createDefaultRootComponent(): QuoteComponent {
  if (defaultPresets.presetComponents?.length) {
    const preset = defaultPresets.presetComponents[0];
    const parsed = quoteComponentSchema.safeParse({
      ...preset,
      id: uid('cmp')
    });
    if (parsed.success) {
      return parsed.data;
    }
    console.warn('[store] presetComponents[0] invalido, usando componente por defecto.', parsed.error);
  }

  return createComponentByMeasure('AREA');
}

function createNewJob(name: string, currency: string): Job {
  const root = createDefaultRootComponent();
  const candidate = {
    id: uid('job'),
    name,
    currency,
    rootComponent: root,
    globalWastePct: 0,
    fixedCost: 0,
    tax: { enabled: false, pct: 0 },
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  const parsed = jobSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }

  console.warn('[store] job inicial invalido, aplicando fallback seguro.', parsed.error);
  return {
    id: uid('job'),
    name: name || 'Trabajo universal',
    currency: currency || 'GTQ',
    rootComponent: createComponentByMeasure('AREA'),
    globalWastePct: 0,
    fixedCost: 0,
    tax: { enabled: false, pct: 0 },
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

const initialMaterials = collectValidDefaults(defaultMaterials, toValidMaterial, 'material default');
const initialRecipes = collectValidDefaults(defaultRecipes, toValidRecipe, 'recipe default');
const initialJob = createNewJob(defaultPresets.presetJobs?.[0]?.name || 'Trabajo universal', defaultPresets.presetJobs?.[0]?.currency || 'GTQ');

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      mode: 'assistant',
      materials: initialMaterials,
      recipes: initialRecipes,
      jobs: [initialJob],
      currentJobId: initialJob.id,
      selectedComponentId: initialJob.rootComponent.id,

      setMode: (mode) => set({ mode }),

      resetToDefaults: () => {
        const job = createNewJob(defaultPresets.presetJobs?.[0]?.name || 'Trabajo universal', defaultPresets.presetJobs?.[0]?.currency || 'GTQ');
        set({
          mode: 'assistant',
          materials: initialMaterials,
          recipes: initialRecipes,
          jobs: [job],
          currentJobId: job.id,
          selectedComponentId: job.rootComponent.id
        });
      },

      createJob: (name, currency) => {
        const job = createNewJob(name, currency);
        set((state) => ({
          jobs: [job, ...state.jobs],
          currentJobId: job.id,
          selectedComponentId: job.rootComponent.id
        }));
        return job;
      },

      setCurrentJobId: (jobId) => {
        if (!jobId) {
          set({ currentJobId: null, selectedComponentId: null });
          return;
        }

        const state = get();
        const job = state.jobs.find((entry) => entry.id === jobId);
        if (!job) return;

        set({
          currentJobId: job.id,
          selectedComponentId: job.rootComponent.id
        });
      },

      deleteJob: (jobId) => {
        set((state) => {
          const jobs = state.jobs.filter((job) => job.id !== jobId);
          const next = {
            ...state,
            jobs
          } as AppState;

          return {
            jobs,
            ...ensureCurrentSelection(next)
          };
        });
      },

      updateCurrentJobMeta: (patch) => {
        set((state) => {
          if (!state.currentJobId) return state;
          return {
            jobs: state.jobs.map((job) => (job.id === state.currentJobId
              ? {
                  ...job,
                  ...patch,
                  updatedAt: nowIso()
                }
              : job))
          };
        });
      },

      setSelectedComponentId: (componentId) => set({ selectedComponentId: componentId }),

      addComponent: (parentComponentId, measureType) => {
        set((state) => {
          if (!state.currentJobId) return state;
          const child = createComponentByMeasure(measureType);

          return {
            jobs: state.jobs.map((job) => {
              if (job.id !== state.currentJobId) return job;
              return {
                ...job,
                rootComponent: addChildToComponent(job.rootComponent, parentComponentId, child),
                updatedAt: nowIso()
              };
            }),
            selectedComponentId: child.id
          };
        });
      },

      removeComponent: (componentId) => {
        set((state) => {
          if (!state.currentJobId) return state;

          return {
            jobs: state.jobs.map((job) => {
              if (job.id !== state.currentJobId) return job;
              if (job.rootComponent.id === componentId) return job;
              return {
                ...job,
                rootComponent: removeComponentById(job.rootComponent, componentId),
                updatedAt: nowIso()
              };
            }),
            selectedComponentId: null
          };
        });

        const current = get();
        if (!current.currentJobId) return;
        const job = current.jobs.find((entry) => entry.id === current.currentJobId);
        if (!job) return;
        set({ selectedComponentId: job.rootComponent.id });
      },

      updateComponent: (componentId, updater) => {
        set((state) => {
          if (!state.currentJobId) return state;

          return {
            jobs: state.jobs.map((job) => {
              if (job.id !== state.currentJobId) return job;
              return {
                ...job,
                rootComponent: updateComponentById(job.rootComponent, componentId, updater),
                updatedAt: nowIso()
              };
            })
          };
        });
      },

      saveMaterial: (material) => {
        const valid = toValidMaterial(material);
        set((state) => {
          const index = state.materials.findIndex((item) => item.id === valid.id);
          if (index < 0) {
            return { materials: [valid, ...state.materials] };
          }

          const next = [...state.materials];
          next[index] = valid;
          return { materials: next };
        });
      },

      removeMaterial: (materialId) => {
        set((state) => ({ materials: state.materials.filter((mat) => mat.id !== materialId) }));
      },

      saveRecipe: (recipe) => {
        const valid = toValidRecipe(recipe);
        set((state) => {
          const index = state.recipes.findIndex((item) => item.id === valid.id);
          if (index < 0) {
            return { recipes: [valid, ...state.recipes] };
          }

          const next = [...state.recipes];
          next[index] = valid;
          return { recipes: next };
        });
      },

      removeRecipe: (recipeId) => {
        set((state) => ({ recipes: state.recipes.filter((recipe) => recipe.id !== recipeId) }));
      },

      importAll: (payload) => {
        try {
          const materials = normalizeLegacyMaterials((payload.materials || []).map(toValidMaterial));
          const recipes = normalizeLegacyRecipes((payload.recipes || []).map(toValidRecipe));
          const jobs = (payload.jobs || []).map(toValidJob);

          set((state) => {
            const mode = payload.mode || state.mode;
            const next: Partial<AppState> = {
              mode,
              materials: materials.length ? materials : state.materials,
              recipes: recipes.length ? recipes : state.recipes,
              jobs: jobs.length ? jobs : state.jobs
            };

            const merged = {
              ...state,
              ...next
            } as AppState;

            return {
              ...next,
              ...ensureCurrentSelection(merged)
            };
          });

          return { ok: true, message: 'Importacion aplicada.' };
        } catch (error) {
          return { ok: false, message: `Importacion invalida: ${String((error as Error).message || error)}` };
        }
      },

      exportAll: () => {
        const state = get();
        return {
          mode: state.mode,
          materials: state.materials,
          recipes: state.recipes,
          jobs: state.jobs
        };
      }
    }),
    {
      name: APP_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState, currentState) => {
        const validated = validatePersistedState(persistedState);
        if (!validated) return currentState;

        const merged = {
          ...currentState,
          ...validated
        } as AppState;

        merged.materials = normalizeLegacyMaterials(merged.materials);
        merged.recipes = normalizeLegacyRecipes(merged.recipes);

        return {
          ...merged,
          ...ensureCurrentSelection(merged)
        };
      },
      partialize: (state) => ({
        mode: state.mode,
        materials: state.materials,
        recipes: state.recipes,
        jobs: state.jobs,
        currentJobId: state.currentJobId,
        selectedComponentId: state.selectedComponentId
      })
    }
  )
);

export function useCurrentJob() {
  return useAppStore((state) => state.jobs.find((job) => job.id === state.currentJobId) || null);
}

export function useSelectedComponent() {
  return useAppStore((state) => {
    const job = state.jobs.find((entry) => entry.id === state.currentJobId);
    if (!job || !state.selectedComponentId) return null;
    return findComponentById(job.rootComponent, state.selectedComponentId);
  });
}


