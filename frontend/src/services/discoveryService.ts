/**
 * Discovery Service Factory
 * 
 * Provides discovery service based on configuration.
 */

import type { IBlockDiscoveryService } from './interfaces/IBlockDiscoveryService';
import { getMockDiscoveryService } from './mock/mockDiscoveryService';
import { getRealDiscoveryService } from './real/realDiscoveryService';

/**
 * Create discovery service instance based on configuration
 */
function createDiscoveryService(): IBlockDiscoveryService {
  const useMock = import.meta.env.VITE_USE_MOCK_BACKEND === 'true';

  if (import.meta.env.DEV) {
    console.log(`[DiscoveryService] Using ${useMock ? 'MOCK' : 'REAL'} backend`);
  }

  return useMock ? getMockDiscoveryService() : getRealDiscoveryService();
}

/**
 * Discovery service singleton
 */
export const discoveryService = createDiscoveryService();

// Re-export types for convenience
export type {
  IBlockDiscoveryService,
  BlockFilter,
  BlockSummary,
  BlockSchema,
  WorkflowContext,
  BlockSuggestion,
  BlockStats,
  Execution,
} from './interfaces/IBlockDiscoveryService';
