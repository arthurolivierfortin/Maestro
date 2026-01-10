/**
 * Model Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from './modelStore';
import type { Model } from '../types/model.types';

describe('useModelStore', () => {
  beforeEach(() => {
    // Clear store before each test
    useModelStore.getState().clear();
  });

  const createTestModel = (overrides?: Partial<Model>): Model => ({
    id: 'test-model-1',
    provider: 'openai',
    displayName: 'Test Model',
    description: 'A test model',
    capabilities: ['code-generation', 'reasoning'],
    contextWindow: 8000,
    maxOutputTokens: 4000,
    costPerInputToken: 0.01 / 1000,
    costPerOutputToken: 0.03 / 1000,
    speedRating: 7,
    qualityRatings: {
      'code-generation': 8,
      'code-review': 7,
    },
    strengths: ['Fast', 'Accurate'],
    weaknesses: ['Expensive'],
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: false,
    isLocal: false,
    isAvailable: true,
    ...overrides,
  });

  describe('addModel', () => {
    it('should add a model to the store', () => {
      const model = createTestModel();
      useModelStore.getState().addModel(model);

      const storedModel = useModelStore.getState().models.get(model.id);
      expect(storedModel).toBeDefined();
      expect(storedModel?.id).toBe(model.id);
    });

    it('should set first model as default', () => {
      const model = createTestModel();
      useModelStore.getState().addModel(model);

      const defaultModelId = useModelStore.getState().defaultModelId;
      expect(defaultModelId).toBe(model.id);
    });

    it('should add timestamps to model', () => {
      const model = createTestModel();
      useModelStore.getState().addModel(model);

      const storedModel = useModelStore.getState().models.get(model.id);
      expect(storedModel?.createdAt).toBeDefined();
      expect(storedModel?.updatedAt).toBeDefined();
    });
  });

  describe('updateModel', () => {
    it('should update an existing model', () => {
      const model = createTestModel();
      useModelStore.getState().addModel(model);

      const updates = { displayName: 'Updated Model' };
      useModelStore.getState().updateModel(model.id, updates);

      const storedModel = useModelStore.getState().models.get(model.id);
      expect(storedModel?.displayName).toBe('Updated Model');
    });

    it('should update updatedAt timestamp', () => {
      const model = createTestModel();
      useModelStore.getState().addModel(model);

      const originalUpdatedAt = useModelStore.getState().models.get(model.id)?.updatedAt;

      // Wait a bit to ensure timestamp changes
      setTimeout(() => {
        useModelStore.getState().updateModel(model.id, { displayName: 'New Name' });
        const updatedModel = useModelStore.getState().models.get(model.id);
        expect(updatedModel?.updatedAt).not.toBe(originalUpdatedAt);
      }, 10);
    });
  });

  describe('removeModel', () => {
    it('should remove a model from the store', () => {
      const model = createTestModel();
      useModelStore.getState().addModel(model);

      useModelStore.getState().removeModel(model.id);

      const storedModel = useModelStore.getState().models.get(model.id);
      expect(storedModel).toBeUndefined();
    });

    it('should clear defaultModelId if removing default model', () => {
      const model = createTestModel();
      useModelStore.getState().addModel(model);

      expect(useModelStore.getState().defaultModelId).toBe(model.id);

      useModelStore.getState().removeModel(model.id);

      expect(useModelStore.getState().defaultModelId).toBeNull();
    });

    it('should clear selectedModelId if removing selected model', () => {
      const model = createTestModel();
      useModelStore.getState().addModel(model);
      useModelStore.getState().setSelectedModel(model.id);

      expect(useModelStore.getState().selectedModelId).toBe(model.id);

      useModelStore.getState().removeModel(model.id);

      expect(useModelStore.getState().selectedModelId).toBeNull();
    });
  });

  describe('getModel', () => {
    it('should return a model by id', () => {
      const model = createTestModel();
      useModelStore.getState().addModel(model);

      const result = useModelStore.getState().getModel(model.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(model.id);
    });

    it('should return undefined for non-existent model', () => {
      const result = useModelStore.getState().getModel('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getModelsByProvider', () => {
    it('should return models filtered by provider', () => {
      const model1 = createTestModel({ id: 'model-1', provider: 'openai' });
      const model2 = createTestModel({ id: 'model-2', provider: 'anthropic' });
      const model3 = createTestModel({ id: 'model-3', provider: 'openai' });

      useModelStore.getState().addModel(model1);
      useModelStore.getState().addModel(model2);
      useModelStore.getState().addModel(model3);

      const openaiModels = useModelStore.getState().getModelsByProvider('openai');
      expect(openaiModels).toHaveLength(2);
      expect(openaiModels.every((m) => m.provider === 'openai')).toBe(true);
    });

    it('should return empty array for provider with no models', () => {
      const result = useModelStore.getState().getModelsByProvider('google');
      expect(result).toHaveLength(0);
    });
  });

  describe('getModelsByCapability', () => {
    it('should return models filtered by capability', () => {
      const model1 = createTestModel({
        id: 'model-1',
        capabilities: ['code-generation', 'reasoning'],
      });
      const model2 = createTestModel({
        id: 'model-2',
        capabilities: ['vision', 'analysis'],
      });
      const model3 = createTestModel({
        id: 'model-3',
        capabilities: ['code-generation', 'vision'],
      });

      useModelStore.getState().addModel(model1);
      useModelStore.getState().addModel(model2);
      useModelStore.getState().addModel(model3);

      const codeGenModels = useModelStore.getState().getModelsByCapability('code-generation');
      expect(codeGenModels).toHaveLength(2);
      expect(codeGenModels.every((m) => m.capabilities.includes('code-generation'))).toBe(true);
    });
  });

  describe('getAvailableModels', () => {
    it('should return only available models', () => {
      const model1 = createTestModel({ id: 'model-1', isAvailable: true });
      const model2 = createTestModel({ id: 'model-2', isAvailable: false });
      const model3 = createTestModel({ id: 'model-3', isAvailable: true });

      useModelStore.getState().addModel(model1);
      useModelStore.getState().addModel(model2);
      useModelStore.getState().addModel(model3);

      const availableModels = useModelStore.getState().getAvailableModels();
      expect(availableModels).toHaveLength(2);
      expect(availableModels.every((m) => m.isAvailable)).toBe(true);
    });
  });

  describe('getBestModelForTask', () => {
    it('should return the best model for a task type', () => {
      const model1 = createTestModel({
        id: 'model-1',
        qualityRatings: { 'code-generation': 7 },
        speedRating: 8,
        costPerInputToken: 0.01 / 1000,
        isAvailable: true,
      });
      const model2 = createTestModel({
        id: 'model-2',
        qualityRatings: { 'code-generation': 9 },
        speedRating: 6,
        costPerInputToken: 0.03 / 1000,
        isAvailable: true,
      });

      useModelStore.getState().addModel(model1);
      useModelStore.getState().addModel(model2);

      const bestModel = useModelStore.getState().getBestModelForTask('code-generation');
      expect(bestModel).toBeDefined();
      // Should prefer higher quality rating despite higher cost
      expect(bestModel?.id).toBe('model-2');
    });

    it('should return null if no models match constraints', () => {
      const model = createTestModel({
        id: 'model-1',
        capabilities: ['reasoning'],
        isAvailable: true,
      });

      useModelStore.getState().addModel(model);

      const bestModel = useModelStore.getState().getBestModelForTask('code-generation', {
        requiredCapabilities: ['code-generation', 'vision'],
      });

      expect(bestModel).toBeNull();
    });

    it('should filter by cost constraint', () => {
      const cheapModel = createTestModel({
        id: 'cheap',
        costPerInputToken: 0.001 / 1000,
        costPerOutputToken: 0.002 / 1000,
        isAvailable: true,
      });
      const expensiveModel = createTestModel({
        id: 'expensive',
        costPerInputToken: 0.05 / 1000,
        costPerOutputToken: 0.1 / 1000,
        isAvailable: true,
      });

      useModelStore.getState().addModel(cheapModel);
      useModelStore.getState().addModel(expensiveModel);

      const bestModel = useModelStore.getState().getBestModelForTask('code-generation', {
        maxCostPer1kTokens: 0.01,
      });

      expect(bestModel?.id).toBe('cheap');
    });
  });

  describe('setDefaultModel', () => {
    it('should set a model as default', () => {
      const model = createTestModel();
      useModelStore.getState().addModel(model);

      useModelStore.getState().setDefaultModel(model.id);

      expect(useModelStore.getState().defaultModelId).toBe(model.id);
    });
  });

  describe('setSelectedModel', () => {
    it('should set a model as selected', () => {
      const model = createTestModel();
      useModelStore.getState().addModel(model);

      useModelStore.getState().setSelectedModel(model.id);

      expect(useModelStore.getState().selectedModelId).toBe(model.id);
    });

    it('should allow clearing selection', () => {
      const model = createTestModel();
      useModelStore.getState().addModel(model);
      useModelStore.getState().setSelectedModel(model.id);

      useModelStore.getState().setSelectedModel(null);

      expect(useModelStore.getState().selectedModelId).toBeNull();
    });
  });
});
