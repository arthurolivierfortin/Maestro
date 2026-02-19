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
import { apiClient } from '../api';

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
    if (filter?.tags) filter.tags.forEach((tag) => params.append('tags', tag));

    const query = params.toString();
    return apiClient.get<BlockSummary[]>(`${this.basePath}/blocks${query ? `?${query}` : ''}`);
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

  async getHealth(): Promise<HealthStatus> {
    const response = await apiClient.get<HealthResponse>(`${this.basePath}/health`);
    return {
      isHealthy: response.status === 'healthy',
      status: response.status,
      version: response.version,
      uptime: response.uptime,
      blockCount: response.blockCount,
      services: response.services || {},
    };
  }

  async getCapabilities(): Promise<Capabilities> {
    const response = await apiClient.get<CapabilitiesResponse>(`${this.basePath}/capabilities`);
    return {
      blockTypes: response.blockTypes || [],
      executors: response.executors || [],
      llmProviders: response.llmProviders || [],
      features: response.features || [],
    };
  }

  async getConfig(): Promise<ConfigInfo> {
    const response = await apiClient.get<ConfigResponse>(`${this.basePath}/config`);
    return {
      blockSearchPaths: response.blockSearchPaths || [],
      defaultLLMProvider: response.defaultLLMProvider,
      executionTimeout: response.executionTimeout,
      maxConcurrentExecutions: response.maxConcurrentExecutions,
      signalREnabled: response.signalREnabled ?? false,
    };
  }
}

// Type definitions for health/capabilities
export interface HealthStatus {
  isHealthy: boolean;
  status: string;
  version: string;
  uptime: number;
  blockCount: number;
  services: Record<string, string>;
}

export interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
  blockCount: number;
  services?: Record<string, string>;
}

export interface Capabilities {
  blockTypes: string[];
  executors: string[];
  llmProviders: string[];
  features: string[];
}

export interface CapabilitiesResponse {
  blockTypes?: string[];
  executors?: string[];
  llmProviders?: string[];
  features?: string[];
}

export interface ConfigInfo {
  blockSearchPaths: string[];
  defaultLLMProvider: string;
  executionTimeout: number;
  maxConcurrentExecutions: number;
  signalREnabled: boolean;
}

export interface ConfigResponse {
  blockSearchPaths?: string[];
  defaultLLMProvider: string;
  executionTimeout: number;
  maxConcurrentExecutions: number;
  signalREnabled?: boolean;
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
