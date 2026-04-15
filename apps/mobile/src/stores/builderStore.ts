import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addChildToComponent,
  applyMeasurePreset,
  createComponentByMeasure,
  createEmptyMaterial,
  createEmptyRecipe,
  createStarterJob,
  findComponentById,
  removeComponentById,
  starterMaterials,
  starterRecipes,
  updateComponentById
} from '@electric/builder-domain';
import {
  type ComponentDerived,
  jobListSchema,
  materialCatalogSchema,
  recipeListSchema,
  type Job,
  type MaterialCatalogItem,
  type MeasureType,
  type QuoteComponent,
  type Recipe
} from '@electric/estimator-core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const BUILDER_STORAGE_KEY = 'electric_mobile_builder_v1';

export type BuilderSnapshot = {
  materials: MaterialCatalogItem[];
  recipes: Recipe[];
  jobs: Job[];
  currentJobId: string | null;
  selectedComponentId: string | null;
};

type BuilderJobMetaPatch = Partial<Pick<Job, 'name' | 'currency' | 'globalWastePct' | 'fixedCost' | 'tax'>>;

type BuilderStore = BuilderSnapshot & {
  resetBuilder: () => void;
  createJob: (name?: string, currency?: string) => Job;
  deleteJob: (jobId: string) => void;
  setCurrentJobId: (jobId: string | null) => void;
  setSelectedComponentId: (componentId: string | null) => void;
  updateCurrentJobMeta: (patch: Partial<Pick<Job, 'name' | 'currency' | 'globalWastePct' | 'fixedCost' | 'tax'>>) => void;
  addComponent: (parentId: string, measureType: MeasureType) => void;
  removeComponent: (componentId: string) => void;
  updateComponentName: (componentId: string, name: string) => void;
  updateComponentMeasureType: (componentId: string, measureType: MeasureType) => void;
  updateComponentInputValue: (componentId: string, inputId: string, value: number) => void;
  updateComponentBaseMeasure: (componentId: string, patch: Partial<QuoteComponent['baseMeasure']>) => void;
  updateComponentLabor: (componentId: string, patch: Partial<QuoteComponent['labor']>) => void;
  updateComponentWastePct: (componentId: string, wastePct: number) => void;
  updateComponentDerived: (componentId: string, derived: ComponentDerived[]) => void;
  bindRecipe: (componentId: string, recipeId: string) => void;
  unbindRecipe: (componentId: string, recipeId: string) => void;
  updateRecipeParamOverride: (componentId: string, recipeId: string, paramId: string, value: number) => void;
  saveMaterial: (material: MaterialCatalogItem) => void;
  createMaterial: (currency?: string) => MaterialCatalogItem;
  removeMaterial: (materialId: string) => void;
  saveRecipe: (recipe: Recipe) => void;
  createRecipe: () => Recipe;
  removeRecipe: (recipeId: string) => void;
  exportSnapshot: () => BuilderSnapshot;
  importSnapshot: (snapshot: unknown) => { ok: boolean; message: string };
};

function nowIso() {
  return new Date().toISOString();
}

function cloneSnapshotValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneBuilderSnapshot(snapshot: BuilderSnapshot): BuilderSnapshot {
  return cloneSnapshotValue(snapshot);
}

function createInitialState(): BuilderSnapshot {
  const job = createStarterJob();
  return {
    materials: cloneSnapshotValue(starterMaterials),
    recipes: cloneSnapshotValue(starterRecipes),
    jobs: [job],
    currentJobId: job.id,
    selectedComponentId: job.rootComponent.id
  };
}

function ensureSelection(state: BuilderSnapshot): Pick<BuilderSnapshot, 'currentJobId' | 'selectedComponentId'> {
  if (!state.jobs.length) {
    return { currentJobId: null, selectedComponentId: null };
  }

  const currentJob = state.jobs.find((job) => job.id === state.currentJobId) ?? state.jobs[0];
  const selected = state.selectedComponentId && findComponentById(currentJob.rootComponent, state.selectedComponentId)
    ? state.selectedComponentId
    : currentJob.rootComponent.id;

  return {
    currentJobId: currentJob.id,
    selectedComponentId: selected
  };
}

function validateSnapshot(snapshot: unknown): { ok: true; value: BuilderSnapshot } | { ok: false; message: string } {
  if (!snapshot || typeof snapshot !== 'object') {
    return { ok: false, message: 'El snapshot debe ser un objeto JSON.' };
  }

  const candidate = snapshot as Partial<BuilderSnapshot>;
  const materialsParsed = materialCatalogSchema.safeParse(candidate.materials ?? []);
  if (!materialsParsed.success) {
    return { ok: false, message: materialsParsed.error.message };
  }

  const recipesParsed = recipeListSchema.safeParse(candidate.recipes ?? []);
  if (!recipesParsed.success) {
    return { ok: false, message: recipesParsed.error.message };
  }

  const jobsParsed = jobListSchema.safeParse(candidate.jobs ?? []);
  if (!jobsParsed.success) {
    return { ok: false, message: jobsParsed.error.message };
  }

  const normalized: BuilderSnapshot = {
    materials: materialsParsed.data,
    recipes: recipesParsed.data,
    jobs: jobsParsed.data,
    currentJobId: typeof candidate.currentJobId === 'string' ? candidate.currentJobId : null,
    selectedComponentId: typeof candidate.selectedComponentId === 'string' ? candidate.selectedComponentId : null
  };

  return {
    ok: true,
    value: {
      ...normalized,
      ...ensureSelection(normalized)
    }
  };
}

function updateCurrentJob(state: BuilderStore, updater: (job: Job) => Job): Job[] {
  return state.jobs.map((job) => {
    if (job.id !== state.currentJobId) return job;
    const next = updater(job);
    return {
      ...next,
      updatedAt: nowIso()
    };
  });
}

function sanitizeJobMetaPatch(job: Job, patch: BuilderJobMetaPatch): BuilderJobMetaPatch {
  const nextPatch: BuilderJobMetaPatch = {};

  if (typeof patch.name === 'string') {
    nextPatch.name = patch.name;
  }

  if (typeof patch.currency === 'string') {
    nextPatch.currency = patch.currency;
  }

  if (patch.globalWastePct !== undefined) {
    nextPatch.globalWastePct = Number.isFinite(patch.globalWastePct)
      ? Math.max(0, Math.min(100, patch.globalWastePct))
      : job.globalWastePct;
  }

  if (patch.fixedCost !== undefined) {
    nextPatch.fixedCost = Number.isFinite(patch.fixedCost) ? Math.max(0, patch.fixedCost) : job.fixedCost;
  }

  if (patch.tax !== undefined) {
    nextPatch.tax = patch.tax && typeof patch.tax === 'object'
      ? {
          enabled: typeof patch.tax.enabled === 'boolean' ? patch.tax.enabled : job.tax.enabled,
          pct: Number.isFinite(patch.tax.pct) ? Math.max(0, Math.min(100, patch.tax.pct)) : job.tax.pct
        }
      : job.tax;
  }

  return nextPatch;
}

function updateComponent(
  state: BuilderStore,
  componentId: string,
  updater: (component: QuoteComponent) => QuoteComponent
): Job[] {
  return updateCurrentJob(state, (job) => ({
    ...job,
    rootComponent: updateComponentById(job.rootComponent, componentId, updater)
  }));
}

function stripRecipeBinding(component: QuoteComponent, recipeId: string): QuoteComponent {
  return {
    ...component,
    recipeBindings: component.recipeBindings.filter((binding) => binding.recipeId !== recipeId),
    children: component.children.map((child) => stripRecipeBinding(child, recipeId))
  };
}

const initialState = createInitialState();

export const useBuilderStore = create<BuilderStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      resetBuilder: () => {
        set(createInitialState());
      },

      createJob: (name = 'Trabajo nuevo', currency = 'GTQ') => {
        const job = createStarterJob(name, currency);
        set((state) => ({
          jobs: [job, ...state.jobs],
          currentJobId: job.id,
          selectedComponentId: job.rootComponent.id
        }));
        return job;
      },

      deleteJob: (jobId) => {
        set((state) => {
          const next: BuilderSnapshot = {
            ...state,
            jobs: state.jobs.filter((job) => job.id !== jobId)
          };
          return {
            jobs: next.jobs,
            ...ensureSelection(next)
          };
        });
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

      setSelectedComponentId: (componentId) => {
        if (!componentId) {
          set({ selectedComponentId: null });
          return;
        }

        const state = get();
        const currentJob = state.jobs.find((job) => job.id === state.currentJobId);
        if (!currentJob || !findComponentById(currentJob.rootComponent, componentId)) {
          return;
        }

        set({ selectedComponentId: componentId });
      },

      updateCurrentJobMeta: (patch) => {
        set((state) => ({
          jobs: updateCurrentJob(state, (job) => ({
            ...job,
            ...sanitizeJobMetaPatch(job, patch)
          }))
        }));
      },

      addComponent: (parentId, measureType) => {
        const child = createComponentByMeasure(measureType);
        set((state) => ({
          jobs: updateCurrentJob(state, (job) => ({
            ...job,
            rootComponent: addChildToComponent(job.rootComponent, parentId, child)
          })),
          selectedComponentId: child.id
        }));
      },

      removeComponent: (componentId) => {
        set((state) => {
          if (!state.currentJobId) return state;

          const currentJob = state.jobs.find((job) => job.id === state.currentJobId);
          if (!currentJob || currentJob.rootComponent.id === componentId) return state;

          const next: BuilderSnapshot = {
            ...state,
            jobs: updateCurrentJob(state, (job) => ({
              ...job,
              rootComponent: removeComponentById(job.rootComponent, componentId)
            })),
            selectedComponentId: null
          };

          return {
            jobs: next.jobs,
            ...ensureSelection(next)
          };
        });
      },

      updateComponentName: (componentId, name) => {
        set((state) => ({
          jobs: updateComponent(state, componentId, (component) => ({
            ...component,
            name
          }))
        }));
      },

      updateComponentMeasureType: (componentId, measureType) => {
        set((state) => ({
          jobs: updateComponent(state, componentId, (component) => applyMeasurePreset(component, measureType))
        }));
      },

      updateComponentInputValue: (componentId, inputId, value) => {
        set((state) => ({
          jobs: updateComponent(state, componentId, (component) => ({
            ...component,
            inputValues: {
              ...component.inputValues,
              [inputId]: Number.isFinite(value) ? value : 0
            }
          }))
        }));
      },

      updateComponentBaseMeasure: (componentId, patch) => {
        set((state) => ({
          jobs: updateComponent(state, componentId, (component) => ({
            ...component,
            baseMeasure: {
              ...component.baseMeasure,
              ...patch
            }
          }))
        }));
      },

      updateComponentLabor: (componentId, patch) => {
        set((state) => ({
          jobs: updateComponent(state, componentId, (component) => ({
            ...component,
            labor: {
              ...component.labor,
              ...patch
            }
          }))
        }));
      },

      updateComponentWastePct: (componentId, wastePct) => {
        set((state) => ({
          jobs: updateComponent(state, componentId, (component) => ({
            ...component,
            wastePct: Number.isFinite(wastePct) ? Math.max(0, Math.min(100, wastePct)) : 0
          }))
        }));
      },

      updateComponentDerived: (componentId, derived) => {
        set((state) => ({
          jobs: updateComponent(state, componentId, (component) => ({
            ...component,
            derived
          }))
        }));
      },

      bindRecipe: (componentId, recipeId) => {
        set((state) => ({
          jobs: updateComponent(state, componentId, (component) => {
            if (component.recipeBindings.some((binding) => binding.recipeId === recipeId)) {
              return component;
            }

            return {
              ...component,
              recipeBindings: [
                ...component.recipeBindings,
                {
                  recipeId,
                  enabled: true,
                  paramOverrides: {}
                }
              ]
            };
          })
        }));
      },

      unbindRecipe: (componentId, recipeId) => {
        set((state) => ({
          jobs: updateComponent(state, componentId, (component) => ({
            ...component,
            recipeBindings: component.recipeBindings.filter((binding) => binding.recipeId !== recipeId)
          }))
        }));
      },

      updateRecipeParamOverride: (componentId, recipeId, paramId, value) => {
        set((state) => ({
          jobs: updateComponent(state, componentId, (component) => ({
            ...component,
            recipeBindings: component.recipeBindings.map((binding) => (
              binding.recipeId !== recipeId
                ? binding
                : {
                    ...binding,
                    paramOverrides: {
                      ...binding.paramOverrides,
                      [paramId]: Number.isFinite(value) ? value : 0
                    }
                  }
            ))
          }))
        }));
      },

      saveMaterial: (material) => {
        set((state) => {
          const index = state.materials.findIndex((entry) => entry.id === material.id);
          if (index < 0) {
            return { materials: [material, ...state.materials] };
          }

          const next = [...state.materials];
          next[index] = material;
          return { materials: next };
        });
      },

      createMaterial: (currency = 'GTQ') => {
        const material = createEmptyMaterial(currency);
        set((state) => ({
          materials: [material, ...state.materials]
        }));
        return material;
      },

      removeMaterial: (materialId) => {
        set((state) => ({
          materials: state.materials.filter((material) => material.id !== materialId)
        }));
      },

      saveRecipe: (recipe) => {
        set((state) => {
          const index = state.recipes.findIndex((entry) => entry.id === recipe.id);
          if (index < 0) {
            return { recipes: [recipe, ...state.recipes] };
          }

          const next = [...state.recipes];
          next[index] = recipe;
          return { recipes: next };
        });
      },

      createRecipe: () => {
        const recipe = createEmptyRecipe();
        set((state) => ({
          recipes: [recipe, ...state.recipes]
        }));
        return recipe;
      },

      removeRecipe: (recipeId) => {
        set((state) => ({
          recipes: state.recipes.filter((recipe) => recipe.id !== recipeId),
          jobs: state.jobs.map((job) => ({
            ...job,
            rootComponent: stripRecipeBinding(job.rootComponent, recipeId),
            updatedAt: nowIso()
          }))
        }));
      },

      exportSnapshot: () => {
        const state = get();
        return cloneBuilderSnapshot({
          materials: state.materials,
          recipes: state.recipes,
          jobs: state.jobs,
          currentJobId: state.currentJobId,
          selectedComponentId: state.selectedComponentId
        });
      },

      importSnapshot: (snapshot) => {
        const validated = validateSnapshot(snapshot);
        if (!validated.ok) {
          return validated;
        }

        set(validated.value);
        return { ok: true, message: 'Snapshot importado.' };
      }
    }),
    {
      name: BUILDER_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        materials: state.materials,
        recipes: state.recipes,
        jobs: state.jobs,
        currentJobId: state.currentJobId,
        selectedComponentId: state.selectedComponentId
      }),
      merge: (persistedState, currentState) => {
        const candidate: BuilderSnapshot = {
          materials: currentState.materials,
          recipes: currentState.recipes,
          jobs: currentState.jobs,
          currentJobId: currentState.currentJobId,
          selectedComponentId: currentState.selectedComponentId,
          ...(persistedState as Partial<BuilderSnapshot> | undefined)
        };
        const validated = validateSnapshot(candidate);

        if (!validated.ok) {
          console.warn('[builderStore] Ignoring invalid persisted snapshot:', validated.message);
          return currentState;
        }

        return {
          ...currentState,
          ...validated.value
        };
      }
    }
  )
);

export function useCurrentBuilderJob() {
  return useBuilderStore((state) => state.jobs.find((job) => job.id === state.currentJobId) ?? null);
}

export function useSelectedBuilderComponent() {
  return useBuilderStore((state) => {
    const job = state.jobs.find((entry) => entry.id === state.currentJobId);
    if (!job || !state.selectedComponentId) return null;
    return findComponentById(job.rootComponent, state.selectedComponentId);
  });
}
