/**
 * useModelSelection Hook
 *
 * Hook for managing model selection in components.
 * Provides helpers for querying and selecting models.
 */

import { useMemo } from 'react';
import { useModelStore } from '../store/modelStore';
import type { ModelProvider, ModelCapability, TaskType } from '../types/model.types';

export interface UseModelSelectionOptions {
  filterByProvider?: ModelProvider;
  filterByCapability?: ModelCapability;
  onlyAvailable?: boolean;
}

/**
 * Hook for model selection logic
 */
export function useModelSelection(options: UseModelSelectionOptions = {}) {
  const models = useModelStore((state) => state.models);
  const selectedModelId = useModelStore((state) => state.selectedModelId);
  const defaultModelId = useModelStore((state) => state.defaultModelId);
  const setSelectedModel = useModelStore((state) => state.setSelectedModel);
  const getModel = useModelStore((state) => state.getModel);

  // Filter models based on options
  const filteredModels = useMemo(() => {
    let result = Array.from(models.values());

    if (options.onlyAvailable) {
      result = result.filter((m) => m.isAvailable);
    }

    if (options.filterByProvider) {
      result = result.filter((m) => m.provider === options.filterByProvider);
    }

    if (options.filterByCapability) {
      result = result.filter((m) => m.capabilities.includes(options.filterByCapability!));
    }

    return result;
  }, [models, options]);

  // Get selected model
  const selectedModel = useMemo(() => {
    return selectedModelId ? getModel(selectedModelId) : null;
  }, [selectedModelId, getModel]);

  // Get default model
  const defaultModel = useMemo(() => {
    return defaultModelId ? getModel(defaultModelId) : null;
  }, [defaultModelId, getModel]);

  return {
    models: filteredModels,
    selectedModel,
    defaultModel,
    setSelectedModel,
  };
}

/**
 * Hook for getting the best model for a specific task
 */
export function useBestModel(taskType: TaskType) {
  const getBestModelForTask = useModelStore((state) => state.getBestModelForTask);
  
  const bestModel = useMemo(() => {
    return getBestModelForTask(taskType);
  }, [getBestModelForTask, taskType]);

  return bestModel;
}

/**
 * Hook for getting models grouped by provider
 */
export function useModelsByProvider() {
  const models = useModelStore((state) => state.models);

  const modelsByProvider = useMemo(() => {
    const grouped = new Map<ModelProvider, typeof models extends Map<string, infer M> ? M[] : never>();
    
    models.forEach((model) => {
      const existing = grouped.get(model.provider) || [];
      grouped.set(model.provider, [...existing, model]);
    });

    return grouped;
  }, [models]);

  return modelsByProvider;
}
