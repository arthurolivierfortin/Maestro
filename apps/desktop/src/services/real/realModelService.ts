/**
 * Real Model Service
 *
 * Communicates with the actual backend API for model management.
 */

import type {
  IModelService,
  CreateModelDto,
  UpdateModelDto,
  ConnectionTestResult,
} from '../interfaces/IModelService';
import type { Model } from '../../types/model.types';
import { apiClient } from '../api';

/**
 * Real Model Service Implementation
 */
class RealModelService implements IModelService {
  private readonly basePath = '/api/models';

  async getAll(): Promise<Model[]> {
    return apiClient.get<Model[]>(this.basePath);
  }

  async getById(id: string): Promise<Model | null> {
    try {
      return await apiClient.get<Model>(`${this.basePath}/${encodeURIComponent(id)}`);
    } catch (error) {
      // Return null for 404, re-throw other errors
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async create(dto: CreateModelDto): Promise<Model> {
    return apiClient.post<Model>(this.basePath, dto);
  }

  async update(id: string, updates: UpdateModelDto): Promise<Model> {
    return apiClient.put<Model>(`${this.basePath}/${encodeURIComponent(id)}`, updates);
  }

  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${encodeURIComponent(id)}`);
  }

  async testConnection(id: string, apiEndpoint?: string): Promise<ConnectionTestResult> {
    const body = apiEndpoint ? { apiEndpoint } : {};
    return apiClient.post<ConnectionTestResult>(
      `${this.basePath}/${encodeURIComponent(id)}/test`,
      body
    );
  }
}

// Singleton instance
let instance: RealModelService | null = null;

/**
 * Get the real model service instance
 */
export function getRealModelService(): IModelService {
  if (!instance) {
    instance = new RealModelService();
  }
  return instance;
}
