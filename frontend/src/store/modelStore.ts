/**
 * Model Store (Zustand)
 *
 * Global state management for AI models with persistence.
 * Manages model registry, selection, and query operations.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  Model,
  ModelProvider,
  ModelCapability,
  TaskType,
  ModelConstraints,
} from '../types/model.types';

/**
 * Model Store State
 */
interface ModelStoreState {
  // State
  models: Map<string, Model>;
  selectedModelId: string | null;
  defaultModelId: string | null;
  isLoading: boolean;
  error: string | null;

  // CRUD Actions
  addModel: (model: Model) => void;
  updateModel: (id: string, updates: Partial<Model>) => void;
  removeModel: (id: string) => void;
  setDefaultModel: (id: string) => void;
  setSelectedModel: (id: string | null) => void;

  // Query helpers
  getModel: (id: string) => Model | undefined;
  getModelsByProvider: (provider: ModelProvider) => Model[];
  getModelsByCapability: (capability: ModelCapability) => Model[];
  getAvailableModels: () => Model[];
  getBestModelForTask: (taskType: TaskType, constraints?: ModelConstraints) => Model | null;

  // Testing
  testModelConnection: (id: string) => Promise<boolean>;

  // Persistence
  loadFromStorage: () => void;
  saveToStorage: () => void;

  // Utility
  clear: () => void;
  setModels: (models: Map<string, Model>) => void;
}

/**
 * Convert Map to array for serialization
 */
function mapToArray<T>(map: Map<string, T>): [string, T][] {
  return Array.from(map.entries());
}

/**
 * Convert array to Map for deserialization
 */
function arrayToMap<T>(array: [string, T][]): Map<string, T> {
  return new Map(array);
}

/**
 * Score a model for a specific task type with constraints
 */
function scoreModelForTask(
  model: Model,
  taskType: TaskType,
  constraints?: ModelConstraints
): number {
  let score = 100;

  // Check availability - required
  if (!model.isAvailable) {
    return -1;
  }

  // Check required capabilities
  if (constraints?.requiredCapabilities) {
    const hasAllCapabilities = constraints.requiredCapabilities.every((cap) =>
      model.capabilities.includes(cap)
    );
    if (!hasAllCapabilities) {
      return -1; // Disqualified
    }
  }

  // Check cost constraint
  if (constraints?.maxCostPer1kTokens !== undefined) {
    const avgCost = (model.costPerInputToken + model.costPerOutputToken) * 500;
    if (avgCost > constraints.maxCostPer1kTokens) {
      return -1; // Disqualified
    }
  }

  // Check context window constraint
  if (constraints?.minContextWindow !== undefined) {
    if (model.contextWindow < constraints.minContextWindow) {
      return -1; // Disqualified
    }
  }

  // Check speed rating constraint
  if (constraints?.minSpeedRating !== undefined) {
    if (model.speedRating < constraints.minSpeedRating) {
      return -1; // Disqualified
    }
  }

  // Check quality rating constraint
  if (constraints?.minQualityRating) {
    const qualityForTask = model.qualityRatings[constraints.minQualityRating.taskType];
    if (!qualityForTask || qualityForTask < constraints.minQualityRating.rating) {
      return -1; // Disqualified
    }
  }

  // Check provider constraints
  if (constraints?.providers) {
    if (constraints.providers.include && !constraints.providers.include.includes(model.provider)) {
      return -1; // Disqualified
    }
    if (constraints.providers.exclude && constraints.providers.exclude.includes(model.provider)) {
      return -1; // Disqualified
    }
  }

  // Prefer local models if requested
  if (constraints?.preferLocal && model.isLocal) {
    score += 20;
  }

  // Add quality rating for this task type
  const qualityRating = model.qualityRatings[taskType];
  if (qualityRating !== undefined) {
    score += qualityRating * 10; // Scale 1-10 to 10-100
  }

  // Consider speed rating (1-10)
  score += model.speedRating * 5; // Scale 1-10 to 5-50

  // Penalize cost (lower is better)
  const avgCostPer1k = (model.costPerInputToken + model.costPerOutputToken) * 500;
  score -= avgCostPer1k * 10; // Penalize expensive models

  return score;
}

/**
 * Create Model Store
 */
export const useModelStore = create<ModelStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        models: new Map(),
        selectedModelId: null,
        defaultModelId: null,
        isLoading: false,
        error: null,

        // CRUD Actions
        addModel: (model: Model) => {
          set((state) => {
            const newModels = new Map(state.models);

            // Add timestamps if not present
            const now = new Date().toISOString();
            const modelWithTimestamps: Model = {
              ...model,
              createdAt: model.createdAt || now,
              updatedAt: model.updatedAt || now,
            };

            newModels.set(model.id, modelWithTimestamps);

            // Set as default if it's the first model or marked as default in the preset
            const shouldSetDefault = state.models.size === 0 || modelWithTimestamps.id === 'gpt-4o';

            return {
              models: newModels,
              defaultModelId: shouldSetDefault ? model.id : state.defaultModelId,
            };
          });
        },

        updateModel: (id: string, updates: Partial<Model>) => {
          set((state) => {
            const model = state.models.get(id);
            if (!model) return state;

            const newModels = new Map(state.models);
            newModels.set(id, {
              ...model,
              ...updates,
              updatedAt: new Date().toISOString(),
            });

            return { models: newModels };
          });
        },

        removeModel: (id: string) => {
          set((state) => {
            const newModels = new Map(state.models);
            newModels.delete(id);

            return {
              models: newModels,
              selectedModelId: state.selectedModelId === id ? null : state.selectedModelId,
              defaultModelId: state.defaultModelId === id ? null : state.defaultModelId,
            };
          });
        },

        setDefaultModel: (id: string) => {
          set({ defaultModelId: id });
        },

        setSelectedModel: (id: string | null) => {
          set({ selectedModelId: id });
        },

        // Query helpers
        getModel: (id: string) => {
          return get().models.get(id);
        },

        getModelsByProvider: (provider: ModelProvider) => {
          return Array.from(get().models.values()).filter((model) => model.provider === provider);
        },

        getModelsByCapability: (capability: ModelCapability) => {
          return Array.from(get().models.values()).filter((model) =>
            model.capabilities.includes(capability)
          );
        },

        getAvailableModels: () => {
          return Array.from(get().models.values()).filter((model) => model.isAvailable);
        },

        getBestModelForTask: (taskType: TaskType, constraints?: ModelConstraints) => {
          const models = Array.from(get().models.values());

          // Score each model
          const scoredModels = models
            .map((model) => ({
              model,
              score: scoreModelForTask(model, taskType, constraints),
            }))
            .filter((item) => item.score >= 0) // Remove disqualified models
            .sort((a, b) => b.score - a.score); // Sort by score descending

          return scoredModels.length > 0 ? scoredModels[0].model : null;
        },

        // Testing
        testModelConnection: async (id: string) => {
          const model = get().models.get(id);
          if (!model) return false;

          // TODO: Implement actual connection testing via API
          // For now, simulate a test
          return new Promise((resolve) => {
            setTimeout(() => {
              const isAvailable = Math.random() > 0.1; // 90% success rate for simulation
              get().updateModel(id, { isAvailable });
              resolve(isAvailable);
            }, 1000);
          });
        },

        // Persistence
        loadFromStorage: () => {
          // This is handled by the persist middleware
          const stored = localStorage.getItem('maestro.models');
          if (stored) {
            try {
              const data = JSON.parse(stored);
              set({
                models: arrayToMap(data.models || []),
                defaultModelId: data.defaultModelId || null,
                selectedModelId: data.selectedModelId || null,
              });
            } catch (error) {
              console.error('Failed to load models from storage:', error);
            }
          }
        },

        saveToStorage: () => {
          const state = get();
          const data = {
            models: mapToArray(state.models),
            defaultModelId: state.defaultModelId,
            selectedModelId: state.selectedModelId,
          };
          localStorage.setItem('maestro.models', JSON.stringify(data));
        },

        // Utility
        clear: () => {
          set({
            models: new Map(),
            selectedModelId: null,
            defaultModelId: null,
            error: null,
          });
        },

        setModels: (models: Map<string, Model>) => {
          set({ models });
        },
      }),
      {
        name: 'maestro.models',
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            try {
              const data = JSON.parse(str);
              return {
                state: {
                  ...data.state,
                  models: arrayToMap(data.state.models || []),
                },
              };
            } catch {
              return null;
            }
          },
          setItem: (name, value) => {
            const data = {
              state: {
                ...value.state,
                models: mapToArray(value.state.models),
              },
            };
            localStorage.setItem(name, JSON.stringify(data));
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
      }
    ),
    { name: 'ModelStore' }
  )
);
