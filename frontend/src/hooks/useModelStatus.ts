/**
 * useModelStatus Hook
 *
 * Provides consistent model status logic across the application.
 * Handles detection of local models and proper status determination.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useModelStore } from '../store/modelStore';
import { detectLocalModels, LocalProviderStatus, pullOllamaModel, getOllamaModelName } from '../services/localModelService';
import { getModelCatalog, ALL_MODEL_DEFINITIONS } from '../data/modelCatalog';
import type { ModelCatalogEntry, ModelStatus } from '../types/modelStatus.types';

export interface UseModelStatusResult {
  /** Full catalog with accurate status */
  catalog: ModelCatalogEntry[];
  /** Local provider statuses */
  localProviders: LocalProviderStatus[];
  /** Set of model IDs that are ready to use */
  readyModelIds: Set<string>;
  /** Set of model IDs that can be auto-setup */
  availableModelIds: Set<string>;
  /** Loading state */
  isLoading: boolean;
  /** Refresh detection */
  refresh: () => Promise<void>;
  /** Get status for a specific model */
  getModelStatus: (modelId: string) => ModelStatus;
  /** Check if model can be downloaded */
  canDownload: (modelId: string) => boolean;
  /** Download/setup a model */
  setupModel: (modelId: string, onProgress?: (progress: number) => void) => Promise<boolean>;
}

export function useModelStatus(): UseModelStatusResult {
  const models = useModelStore((state) => state.models);
  const addModel = useModelStore((state) => state.addModel);
  const updateModel = useModelStore((state) => state.updateModel);

  const [localProviders, setLocalProviders] = useState<LocalProviderStatus[]>([]);
  const [availableLocalModels, setAvailableLocalModels] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Get configured model IDs (models with isAvailable: true)
  const configuredModelIds = useMemo(() => {
    const configured = new Set<string>();
    models.forEach((model, id) => {
      if (model.isAvailable) {
        configured.add(id);
      }
    });
    return configured;
  }, [models]);

  // Build catalog with proper status
  const catalog = useMemo(() => {
    const result = getModelCatalog(configuredModelIds, availableLocalModels);

    return result;
  }, [configuredModelIds, availableLocalModels]);

  // Ready model IDs
  const readyModelIds = useMemo(() => {
    return new Set(catalog.filter(m => m.status === 'ready').map(m => m.id));
  }, [catalog]);

  // Available model IDs (can be auto-setup)
  const availableModelIds = useMemo(() => {
    return new Set(catalog.filter(m => m.status === 'available').map(m => m.id));
  }, [catalog]);

  // Detect local models on mount
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const { providers, availableModels } = await detectLocalModels();

      setLocalProviders(providers);
      setAvailableLocalModels(availableModels);

      // Update store models based on detected local models
      providers.forEach(provider => {
        if (provider.available) {
          provider.models.forEach(localModel => {
            // Find matching catalog entry
            const catalogEntry = ALL_MODEL_DEFINITIONS.find(
              def => def.name === localModel.name || def.id === localModel.id
            );

            if (catalogEntry && !models.has(catalogEntry.id)) {
              // Add newly detected local model to store
              addModel({
                id: catalogEntry.id,
                provider: localModel.provider,
                displayName: catalogEntry.displayName,
                description: catalogEntry.description,
                capabilities: catalogEntry.specs.capabilities as any[],
                contextWindow: catalogEntry.specs.contextWindow,
                costPerInputToken: 0,
                costPerOutputToken: 0,
                speedRating: 7,
                qualityRatings: {},
                strengths: [],
                weaknesses: [],
                maxOutputTokens: 4096,
                supportsStreaming: catalogEntry.specs.supportsStreaming ?? true,
                supportsToolCalls: catalogEntry.specs.supportsToolUse ?? false,
                supportsVision: catalogEntry.specs.supportsVision ?? false,
                isLocal: true,
                isAvailable: true,
                apiEndpoint: provider.provider === 'ollama'
                  ? 'http://localhost:11434'
                  : 'http://localhost:8000',
              });
            } else if (catalogEntry && models.has(catalogEntry.id)) {
              // Update existing model to be available
              const existing = models.get(catalogEntry.id);
              if (existing && !existing.isAvailable) {
                updateModel(catalogEntry.id, { isAvailable: true });
              }
            }
          });
        }
      });
    } catch (error) {
      console.error('Failed to detect local models:', error);
    } finally {
      setIsLoading(false);
    }
  }, [models, addModel, updateModel]);

  // Initial detection
  useEffect(() => {
    refresh();
  }, []);

  // Get status for a specific model
  const getModelStatus = useCallback((modelId: string): ModelStatus => {
    const catalogEntry = catalog.find(m => m.id === modelId);
    if (catalogEntry) {
      return catalogEntry.status;
    }

    // Check store
    const storeModel = models.get(modelId);
    if (storeModel?.isAvailable) {
      return 'ready';
    }

    // Check if it's a local model definition
    const definition = ALL_MODEL_DEFINITIONS.find(d => d.id === modelId);
    if (definition?.isLocalModel) {
      return availableLocalModels.has(definition.name) ? 'ready' : 'available';
    }

    return 'not_configured';
  }, [catalog, models, availableLocalModels]);

  // Check if model can be downloaded
  const canDownload = useCallback((modelId: string): boolean => {
    const definition = ALL_MODEL_DEFINITIONS.find(d => d.id === modelId);
    if (!definition?.isLocalModel) {
      return false;
    }

    // Check if Ollama is available
    const ollamaProvider = localProviders.find(p => p.provider === 'ollama');
    if (!ollamaProvider?.available) {
      return false;
    }

    // Check if model is already downloaded
    const ollamaName = getOllamaModelName(modelId);
    if (ollamaName && availableLocalModels.has(ollamaName)) {
      return false; // Already downloaded
    }

    return true;
  }, [localProviders, availableLocalModels]);

  // Setup/download a model
  const setupModel = useCallback(async (
    modelId: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> => {
    const definition = ALL_MODEL_DEFINITIONS.find(d => d.id === modelId);
    if (!definition) {
      return false;
    }

    // For local models, pull from Ollama
    if (definition.isLocalModel) {
      const ollamaName = getOllamaModelName(modelId) || definition.name;
      const success = await pullOllamaModel(ollamaName, onProgress);

      if (success) {
        // Update store
        addModel({
          id: definition.id,
          provider: 'ollama',
          displayName: definition.displayName,
          description: definition.description,
          capabilities: definition.specs.capabilities as any[],
          contextWindow: definition.specs.contextWindow,
          costPerInputToken: 0,
          costPerOutputToken: 0,
          speedRating: 7,
          qualityRatings: {},
          strengths: [],
          weaknesses: [],
          maxOutputTokens: 4096,
          supportsStreaming: definition.specs.supportsStreaming ?? true,
          supportsToolCalls: definition.specs.supportsToolUse ?? false,
          supportsVision: definition.specs.supportsVision ?? false,
          isLocal: true,
          isAvailable: true,
          apiEndpoint: 'http://localhost:11434',
        });

        // Refresh to update status
        await refresh();
      }

      return success;
    }

    return false;
  }, [addModel, refresh]);

  return {
    catalog,
    localProviders,
    readyModelIds,
    availableModelIds,
    isLoading,
    refresh,
    getModelStatus,
    canDownload,
    setupModel,
  };
}
