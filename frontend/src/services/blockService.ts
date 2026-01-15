/**
 * Block Service Factory
 *
 * Returns mock or real service based on maestro.config.json configuration.
 * Components should import this, NOT the specific implementations.
 */

import type { IBlockService } from './interfaces/IBlockService';
import { getMockBlockService } from './mock/mockBlockService';
import { getRealBlockService } from './real/realBlockService';
import { config } from '../config';
import { useMockBackendEffective } from '../config/config';

/**
 * Create block service based on configuration
 */
function createBlockService(): IBlockService {
  const useMock = useMockBackendEffective();

  if (config.devToolsEnabled()) {
    console.log(`[BlockService] Using ${useMock ? 'MOCK' : 'REAL'} backend`);
  }

  return useMock ? getMockBlockService() : getRealBlockService();
}

/**
 * Block Service instance
 *
 * Use this throughout the application for block operations.
 */
export const blockService = createBlockService();

/**
 * Check if currently using mock backend
 */
export function isUsingMockBackend(): boolean {
  return useMockBackendEffective();
}

// Re-export types for convenience
export type {
  IBlockService,
  CreateBlockDto,
  UpdateBlockDto,
  BlockUsage,
} from './interfaces/IBlockService';
