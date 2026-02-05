/**
 * Real Block Service
 *
 * Communicates with the actual backend API for block operations.
 * This is a stub implementation - will be completed when backend is ready.
 */

import type {
  IBlockService,
  CreateBlockDto,
  UpdateBlockDto,
  BlockUsage,
  BlockExecutionResult,
} from '../interfaces/IBlockService';
import type { Block, BlockType } from '../../types/block.types';
import { apiClient } from '../api';
import { initBlockHub } from '../signalr/blockHub';

/**
 * Real Block Service Implementation
 */
class RealBlockService implements IBlockService {
  private readonly basePath = '/api/blocks';

  async getAll(): Promise<Block[]> {
    return apiClient.get<Block[]>(this.basePath);
  }

  async getById(id: string): Promise<Block | null> {
    try {
      return await apiClient.get<Block>(`${this.basePath}/${id}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async create(dto: CreateBlockDto): Promise<Block> {
    return apiClient.post<Block>(this.basePath, dto);
  }

  async update(id: string, updates: UpdateBlockDto): Promise<Block> {
    return apiClient.put<Block>(`${this.basePath}/${id}`, updates);
  }

  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${id}`);
  }

  async getByType(type: BlockType): Promise<Block[]> {
    return apiClient.get<Block[]>(this.basePath, { params: { type } });
  }

  async getByCapability(capability: string): Promise<Block[]> {
    return apiClient.get<Block[]>(this.basePath, { params: { capability } });
  }

  async search(query: string): Promise<Block[]> {
    return apiClient.get<Block[]>(`${this.basePath}/search`, { params: { q: query } });
  }

  async findUsages(blockId: string): Promise<BlockUsage[]> {
    return apiClient.get<BlockUsage[]>(`${this.basePath}/${blockId}/usages`);
  }

  async duplicate(id: string): Promise<Block> {
    return apiClient.post<Block>(`${this.basePath}/${id}/duplicate`);
  }

  async exportAsJson(id: string): Promise<string> {
    const response = await apiClient.get<string>(`${this.basePath}/${id}/export`);
    return response;
  }

  async importFromJson(json: string): Promise<Block> {
    return apiClient.post<Block>(`${this.basePath}/import`, { json });
  }

  async execute(id: string, inputs?: Record<string, any>): Promise<BlockExecutionResult> {
    return apiClient.post<BlockExecutionResult>(`${this.basePath}/${id}/execute`, { inputs });
  }
}

/**
 * Singleton instance
 */
let instance: RealBlockService | null = null;

/**
 * Get real block service instance
 */
export function getRealBlockService(): IBlockService {
  if (!instance) {
    instance = new RealBlockService();
  }
  return instance;
}

// Initialize realtime updates (SignalR). Call once on app startup.
export async function initRealBlockRealtime(baseUrl: string) {
  try {
    await initBlockHub(baseUrl);
  } catch (e) {
    console.warn('initRealBlockRealtime failed', e);
  }
}
