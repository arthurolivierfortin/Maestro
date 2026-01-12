/**
 * Real Block Discovery Service
 * 
 * API client for block discovery operations.
 * Connects to backend API for production use.
 */

import type {
  IBlockDiscoveryService,
  BlockFilter,
  BlockSummary,
  BlockSchema,
  WorkflowContext,
  BlockSuggestion,
  BlockStats,
  Execution,
} from '../interfaces/IBlockDiscoveryService';
import type { Block } from '@/types/block.types';
import { apiClient } from './api';

/**
 * Real Discovery Service Implementation
 */
class RealDiscoveryService implements IBlockDiscoveryService {
  private readonly basePath = '/api/discovery';

  async listAvailableBlocks(filter?: BlockFilter): Promise<BlockSummary[]> {
    const params = new URLSearchParams();
    if (filter?.type) params.append('type', filter.type);
    if (filter?.capability) params.append('capability', filter.capability);
    if (filter?.status) params.append('status', filter.status);
    if (filter?.tags) filter.tags.forEach(tag => params.append('tags', tag));

    const query = params.toString();
    return apiClient.get<BlockSummary[]>(
      `${this.basePath}/blocks${query ? `?${query}` : ''}`
    );
  }

  async getBlockCapabilities(blockId: string): Promise<string[]> {
    return apiClient.get<string[]>(`${this.basePath}/blocks/${blockId}/capabilities`);
  }

  async getBlockSchema(blockId: string): Promise<BlockSchema> {
    return apiClient.get<BlockSchema>(`${this.basePath}/blocks/${blockId}/schema`);
  }

  async suggestBlocks(context: WorkflowContext): Promise<BlockSuggestion[]> {
    return apiClient.post<BlockSuggestion[]>(`${this.basePath}/suggest`, context);
  }

  async findSimilarBlocks(blockId: string): Promise<Block[]> {
    return apiClient.get<Block[]>(`${this.basePath}/blocks/${blockId}/similar`);
  }

  async getBlockStats(blockId: string): Promise<BlockStats> {
    return apiClient.get<BlockStats>(`${this.basePath}/blocks/${blockId}/stats`);
  }

  async getRecentExecutions(blockId: string, limit: number = 10): Promise<Execution[]> {
    return apiClient.get<Execution[]>(
      `${this.basePath}/blocks/${blockId}/executions?limit=${limit}`
    );
  }
}

// Singleton instance
let instance: RealDiscoveryService | null = null;

/**
 * Get real discovery service instance
 */
export function getRealDiscoveryService(): IBlockDiscoveryService {
  if (!instance) {
    instance = new RealDiscoveryService();
  }
  return instance;
}
