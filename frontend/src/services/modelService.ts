/**
 * Model Service Factory
 *
 * Returns mock or real service based on maestro.config.json configuration.
 * Components should import this, NOT the specific implementations.
 */

import type { IModelService } from './interfaces/IModelService';
import { getMockModelService } from './mock/mockModelService';
import { getRealModelService } from './real/realModelService';
import { config } from '../config';
import { useMockBackendEffective } from '../config/config';

/**
 * Create model service based on configuration
 */
function createModelService(): IModelService {
  const useMock = useMockBackendEffective();

  if (config.devToolsEnabled()) {
    console.log(`[ModelService] Using ${useMock ? 'MOCK' : 'REAL'} backend`);
  }

  return useMock ? getMockModelService() : getRealModelService();
}

/**
 * Model Service instance
 *
 * Use this throughout the application for model operations.
 */
export const modelService = createModelService();

/**
 * Check if currently using mock backend
 */
export function isUsingMockBackend(): boolean {
  return useMockBackendEffective();
}

// Re-export types for convenience
export type {
  IModelService,
  CreateModelDto,
  UpdateModelDto,
  ConnectionTestResult,
} from './interfaces/IModelService';
