/**
 * Mock Model Service
 *
 * In-memory implementation of IModelService for development and testing.
 * Simulates network latency and realistic error conditions.
 */

import type {
  IModelService,
  CreateModelDto,
  UpdateModelDto,
  ConnectionTestResult,
} from '../interfaces/IModelService';
import type { Model } from '../../types/model.types';
import { getMockModels } from './mockData/models';
import { delay } from './utils/delay';
import { createNotFoundError, createValidationError, createConflictError } from './utils/errors';

/**
 * Mock Model Service Implementation
 */
class MockModelService implements IModelService {
  private models: Map<string, Model> = new Map();
  private initialized = false;

  /**
   * Initialize with preset data if not already done
   */
  private ensureInitialized(): void {
    if (this.initialized) return;

    const presets = getMockModels();
    presets.forEach((model) => this.models.set(model.id, model));
    this.initialized = true;
  }

  async getAll(): Promise<Model[]> {
    this.ensureInitialized();
    await delay(100, 300);
    return Array.from(this.models.values());
  }

  async getById(id: string): Promise<Model | null> {
    this.ensureInitialized();
    await delay(50, 150);

    const model = this.models.get(id);
    return model ? { ...model } : null;
  }

  async create(dto: CreateModelDto): Promise<Model> {
    this.ensureInitialized();
    await delay(200, 400);

    // Validate required fields
    if (!dto.name?.trim()) {
      throw createValidationError('Model name is required');
    }
    if (!dto.displayName?.trim()) {
      throw createValidationError('Display name is required');
    }
    if (!dto.provider) {
      throw createValidationError('Provider is required');
    }

    // Generate ID if not provided
    const id = dto.id || `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Check for duplicate ID
    if (this.models.has(id)) {
      throw createConflictError('Model', 'id', id);
    }

    const now = new Date().toISOString();
    const model: Model = {
      id,
      provider: dto.provider,
      displayName: dto.displayName,
      description: dto.name,
      capabilities: dto.capabilities || [],
      contextWindow: dto.contextWindow || 4096,
      maxOutputTokens: dto.maxOutputTokens || 4096,
      costPerInputToken: dto.costPerInputToken || 0,
      costPerOutputToken: dto.costPerOutputToken || 0,
      speedRating: dto.speedRating || 5,
      qualityRatings: dto.qualityRatings || {},
      strengths: dto.strengths || [],
      weaknesses: dto.weaknesses || [],
      supportsStreaming: dto.supportsStreaming ?? true,
      supportsToolCalls: dto.supportsToolCalls ?? false,
      supportsVision: dto.supportsVision ?? false,
      isLocal: dto.isLocal ?? false,
      isAvailable: true,
      apiEndpoint: dto.apiEndpoint,
      createdAt: now,
      updatedAt: now,
    };

    this.models.set(id, model);
    return { ...model };
  }

  async update(id: string, updates: UpdateModelDto): Promise<Model> {
    this.ensureInitialized();
    await delay(150, 300);

    const existing = this.models.get(id);
    if (!existing) {
      throw createNotFoundError('Model', id);
    }

    const updated: Model = {
      ...existing,
      ...updates,
      id, // Prevent ID change
      updatedAt: new Date().toISOString(),
    };

    this.models.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.ensureInitialized();
    await delay(100, 200);

    if (!this.models.has(id)) {
      throw createNotFoundError('Model', id);
    }

    this.models.delete(id);
  }

  async testConnection(id: string, apiEndpoint?: string): Promise<ConnectionTestResult> {
    this.ensureInitialized();
    await delay(500, 1500); // Simulate API call

    // Allow testing without an existing model (for new model validation)
    const model = this.models.get(id);

    // Simulate success/failure based on endpoint format
    let success = false;
    let error: string | undefined;

    if (apiEndpoint) {
      // Check if endpoint looks valid
      if (apiEndpoint.startsWith('http://') || apiEndpoint.startsWith('https://')) {
        // Local endpoints always succeed
        if (apiEndpoint.includes('localhost') || apiEndpoint.includes('127.0.0.1')) {
          success = true;
        } else {
          // Remote have 90% success rate
          success = Math.random() > 0.1;
        }
      } else {
        error = 'Invalid endpoint URL format';
      }
    } else if (model) {
      // Known model without endpoint - assume cloud API
      success = model.isLocal ? true : Math.random() > 0.1;
    } else {
      error = 'Model not found and no endpoint provided';
    }

    const latencyMs = success ? Math.floor(Math.random() * 500) + 100 : 0;

    // Update model availability if it exists
    if (model && success !== undefined) {
      this.models.set(id, { ...model, isAvailable: success });
    }

    return {
      success,
      latencyMs,
      error: success ? undefined : error || 'Connection timeout - could not reach API endpoint',
      testedAt: new Date().toISOString(),
    };
  }

  /**
   * Reset to initial state (for testing)
   */
  reset(): void {
    this.models.clear();
    this.initialized = false;
  }
}

// Singleton instance
let instance: MockModelService | null = null;

/**
 * Get the mock model service instance
 */
export function getMockModelService(): IModelService {
  if (!instance) {
    instance = new MockModelService();
  }
  return instance;
}

/**
 * Reset the mock service (for testing)
 */
export function resetMockModelService(): void {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

/**
 * Exported mock service singleton
 */
export const mockModelService = getMockModelService();

/**
 * Reset mock data (alias for testing convenience)
 */
export function resetMockData(): void {
  resetMockModelService();
}
