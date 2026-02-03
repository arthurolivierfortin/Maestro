/**
 * System Block Service
 *
 * Provides API methods for managing system blocks and user overrides.
 * System blocks are default blocks provided by Maestro that can be
 * optionally overridden by users.
 */

import { apiClient } from './api';
import type { Block } from '../types/block.types';

export interface SystemBlockDto extends Block {
  isSystem: true;
  overridable: boolean;
  overridesSystemBlock?: string;
}

export interface HasOverrideResponse {
  blockId: string;
  hasOverride: boolean;
  isOverridable: boolean;
}

export interface CreateOverrideRequest {
  config?: Record<string, unknown>;
}

class SystemBlockService {
  /**
   * Get all system blocks
   */
  async getSystemBlocks(): Promise<SystemBlockDto[]> {
    return apiClient.get<SystemBlockDto[]>('/api/blocks/system');
  }

  /**
   * Get a specific system block by ID
   */
  async getSystemBlock(blockId: string): Promise<SystemBlockDto> {
    return apiClient.get<SystemBlockDto>(`/api/blocks/system/${encodeURIComponent(blockId)}`);
  }

  /**
   * Get all user overrides
   */
  async getUserOverrides(): Promise<Block[]> {
    return apiClient.get<Block[]>('/api/blocks/system/overrides');
  }

  /**
   * Check if a system block has a user override
   */
  async hasOverride(blockId: string): Promise<HasOverrideResponse> {
    return apiClient.get<HasOverrideResponse>(`/api/blocks/system/${encodeURIComponent(blockId)}/has-override`);
  }

  /**
   * Create a user override for a system block
   */
  async createOverride(
    blockId: string,
    request?: CreateOverrideRequest
  ): Promise<Block> {
    return apiClient.post<Block>(`/api/blocks/system/${encodeURIComponent(blockId)}/override`, request || {});
  }

  /**
   * Restore a system block to its default by removing the user override
   */
  async restoreSystemBlock(blockId: string): Promise<void> {
    await apiClient.delete(`/api/blocks/system/${encodeURIComponent(blockId)}/override`);
  }

  /**
   * Get the effective block (with override applied if present)
   */
  async getEffectiveBlock(blockId: string): Promise<Block> {
    return apiClient.get<Block>(`/api/blocks/system/${encodeURIComponent(blockId)}/effective`);
  }
}

export const systemBlockService = new SystemBlockService();
