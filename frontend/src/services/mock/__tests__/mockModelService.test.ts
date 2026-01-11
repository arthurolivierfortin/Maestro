/**
 * Mock Model Service Tests
 *
 * Tests for the mock backend service implementation.
 * These tests verify that the mock service behaves correctly
 * and can be used for frontend testing without a real backend.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the delay to speed up tests - must come before imports
vi.mock('../utils/delay', () => ({
  delay: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocking
import { getMockModelService, resetMockModelService } from '../mockModelService';
import type { CreateModelDto, UpdateModelDto, IModelService } from '../../interfaces/IModelService';

describe('mockModelService', () => {
  let mockModelService: IModelService;

  beforeEach(() => {
    resetMockModelService();
    mockModelService = getMockModelService();
  });

  describe('getAll', () => {
    it('should return all models', async () => {
      const models = await mockModelService.getAll();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should return models with required properties', async () => {
      const models = await mockModelService.getAll();
      const model = models[0];

      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('provider');
      expect(model).toHaveProperty('displayName');
      expect(model).toHaveProperty('capabilities');
      expect(model).toHaveProperty('contextWindow');
    });
  });

  describe('getById', () => {
    it('should return a model by ID', async () => {
      const models = await mockModelService.getAll();
      const firstModel = models[0];

      const model = await mockModelService.getById(firstModel.id);

      expect(model).not.toBeNull();
      expect(model?.id).toBe(firstModel.id);
    });

    it('should return null for non-existent ID', async () => {
      const model = await mockModelService.getById('non-existent-id');

      expect(model).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new model', async () => {
      const dto: CreateModelDto = {
        id: 'test-model-1',
        name: 'Test Model',
        displayName: 'Test Model Display',
        provider: 'custom',
        capabilities: ['code-generation'],
        contextWindow: 4096,
        maxOutputTokens: 2048,
        costPerInputToken: 0.001,
        costPerOutputToken: 0.002,
        speedRating: 7,
        qualityRatings: { 'code-generation': 8 },
        strengths: ['Fast'],
        weaknesses: ['Limited context'],
        supportsStreaming: true,
        supportsToolCalls: false,
        supportsVision: false,
        isLocal: false,
      };

      const model = await mockModelService.create(dto);

      expect(model.id).toBe(dto.id);
      expect(model.displayName).toBe(dto.displayName);
      expect(model.provider).toBe(dto.provider);
    });

    it('should throw error for duplicate ID', async () => {
      const dto: CreateModelDto = {
        id: 'duplicate-model',
        name: 'Duplicate',
        displayName: 'Duplicate',
        provider: 'custom',
        capabilities: [],
        contextWindow: 4096,
        maxOutputTokens: 2048,
        costPerInputToken: 0,
        costPerOutputToken: 0,
        speedRating: 5,
        qualityRatings: {},
        strengths: [],
        weaknesses: [],
        supportsStreaming: false,
        supportsToolCalls: false,
        supportsVision: false,
        isLocal: false,
      };

      // Create first time
      await mockModelService.create(dto);

      // Try to create again
      await expect(mockModelService.create(dto)).rejects.toThrow('already exists');
    });

    it('should throw error for missing required fields', async () => {
      const invalidDto = {
        id: 'invalid-model',
        name: '', // Empty name
        displayName: 'Test',
        provider: 'custom',
        capabilities: [],
        contextWindow: 4096,
        maxOutputTokens: 2048,
        costPerInputToken: 0,
        costPerOutputToken: 0,
        speedRating: 5,
        qualityRatings: {},
        strengths: [],
        weaknesses: [],
        supportsStreaming: false,
        supportsToolCalls: false,
        supportsVision: false,
        isLocal: false,
      } as CreateModelDto;

      await expect(mockModelService.create(invalidDto)).rejects.toThrow('required');
    });
  });

  describe('update', () => {
    it('should update an existing model', async () => {
      const models = await mockModelService.getAll();
      const modelToUpdate = models[0];

      const updateDto: UpdateModelDto = {
        displayName: 'Updated Display Name',
        speedRating: 9,
      };

      const updated = await mockModelService.update(modelToUpdate.id, updateDto);

      expect(updated.displayName).toBe('Updated Display Name');
      expect(updated.speedRating).toBe(9);
      expect(updated.id).toBe(modelToUpdate.id);
    });

    it('should throw error for non-existent model', async () => {
      const updateDto: UpdateModelDto = {
        displayName: 'Updated',
      };

      await expect(
        mockModelService.update('non-existent-id', updateDto)
      ).rejects.toThrow('not found');
    });
  });

  describe('delete', () => {
    it('should delete an existing model', async () => {
      const dto: CreateModelDto = {
        id: 'model-to-delete',
        name: 'To Delete',
        displayName: 'To Delete',
        provider: 'custom',
        capabilities: [],
        contextWindow: 4096,
        maxOutputTokens: 2048,
        costPerInputToken: 0,
        costPerOutputToken: 0,
        speedRating: 5,
        qualityRatings: {},
        strengths: [],
        weaknesses: [],
        supportsStreaming: false,
        supportsToolCalls: false,
        supportsVision: false,
        isLocal: false,
      };

      await mockModelService.create(dto);

      // Verify it exists
      const beforeDelete = await mockModelService.getById('model-to-delete');
      expect(beforeDelete).not.toBeNull();

      // Delete
      await mockModelService.delete('model-to-delete');

      // Verify it's gone
      const afterDelete = await mockModelService.getById('model-to-delete');
      expect(afterDelete).toBeNull();
    });

    it('should throw error for non-existent model', async () => {
      await expect(
        mockModelService.delete('non-existent-id')
      ).rejects.toThrow('not found');
    });
  });

  describe('testConnection', () => {
    it('should return success for local models', async () => {
      const result = await mockModelService.testConnection(
        'local-model',
        'http://localhost:11434'
      );

      expect(result.success).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return failure for invalid endpoints', async () => {
      const result = await mockModelService.testConnection(
        'some-model',
        'invalid-url'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return a result for known providers without endpoint', async () => {
      const models = await mockModelService.getAll();
      const openAIModel = models.find((m) => m.provider === 'openai');

      if (openAIModel) {
        const result = await mockModelService.testConnection(openAIModel.id);
        // Result may succeed or fail based on random, but should have proper structure
        expect(typeof result.success).toBe('boolean');
        expect(result.testedAt).toBeDefined();
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      }
    });
  });
});

describe('resetMockData', () => {
  it('should reset data to initial state', async () => {
    const mockModelService = getMockModelService();
    
    // Create a custom model
    const dto: CreateModelDto = {
      id: 'temporary-model',
      name: 'Temporary',
      displayName: 'Temporary',
      provider: 'custom',
      capabilities: [],
      contextWindow: 4096,
      maxOutputTokens: 2048,
      costPerInputToken: 0,
      costPerOutputToken: 0,
      speedRating: 5,
      qualityRatings: {},
      strengths: [],
      weaknesses: [],
      supportsStreaming: false,
      supportsToolCalls: false,
      supportsVision: false,
      isLocal: false,
    };

    await mockModelService.create(dto);

    // Verify it exists
    let model = await mockModelService.getById('temporary-model');
    expect(model).not.toBeNull();

    // Reset
    resetMockModelService();
    const freshService = getMockModelService();

    // Verify it's gone
    model = await freshService.getById('temporary-model');
    expect(model).toBeNull();
  });
});
