/**
 * Block Service Factory
 *
 * Returns mock or real service based on environment configuration.
 * Phase 4f.6 - Missing CRUD Functionality
 */

import type { IBlockService } from './interfaces/IBlockService';
import { getMockBlockService } from './mock/mockBlockService';

/**
 * Block Service Factory
 *
 * Returns the appropriate block service implementation based on configuration.
 * Currently only mock service is implemented.
 */
function createBlockService(): IBlockService {
  // TODO: Check environment config for useMockBackend
  const useMock = true; // Always use mock for now

  if (import.meta.env.DEV) {
    console.log(`[BlockService] Using ${useMock ? 'MOCK' : 'REAL'} backend`);
  }

  return getMockBlockService();
}

/**
 * Block Service instance
 *
 * Import this in components to access block operations.
 */
export const blockService = createBlockService();

// Re-export types for convenience
export type { IBlockService, IBlockDiscoveryService } from './interfaces/IBlockService';
export type {
  CreateBlockRequest,
  UpdateBlockRequest,
  OperationResult,
} from './interfaces/IBlockService';
