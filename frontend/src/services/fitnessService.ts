/**
 * Fitness Service (Phase 11)
 *
 * API service for model fitness calculations, profiles, and rankings.
 */

import { apiClient } from './api';
import type {
  FitnessScore,
  FitnessConfig,
  ModelProfile,
  TaskEntropy,
  ModelFitnessRanking,
  AggregateFitnessStats,
  CalculateFitnessRequest,
  UpdateModelProfileRequest,
  UpdateFitnessConfigRequest,
} from '../types';

const FITNESS_BASE = '/api/fitness';

/**
 * Fitness API service
 */
export const fitnessService = {
  // =====================
  // Fitness Calculation
  // =====================

  /**
   * Calculate fitness for an execution
   */
  async calculateFitness(request: CalculateFitnessRequest): Promise<FitnessScore> {
    return apiClient.post<FitnessScore>(`${FITNESS_BASE}/calculate`, request);
  },

  /**
   * Get fitness history for a model
   */
  async getFitnessHistory(
    modelId: string,
    taskType?: string,
    limit: number = 100
  ): Promise<FitnessScore[]> {
    const params = new URLSearchParams();
    if (taskType) params.append('taskType', taskType);
    params.append('limit', limit.toString());

    const queryString = params.toString();
    return apiClient.get<FitnessScore[]>(
      `${FITNESS_BASE}/history/${encodeURIComponent(modelId)}?${queryString}`
    );
  },

  /**
   * Get aggregate fitness statistics for a model
   */
  async getFitnessStats(
    modelId: string,
    taskType?: string
  ): Promise<AggregateFitnessStats> {
    const params = new URLSearchParams();
    if (taskType) params.append('taskType', taskType);

    const queryString = params.toString();
    const url = `${FITNESS_BASE}/stats/${encodeURIComponent(modelId)}${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<AggregateFitnessStats>(url);
  },

  // =====================
  // Configuration
  // =====================

  /**
   * Get the current fitness configuration
   */
  async getConfig(): Promise<FitnessConfig> {
    return apiClient.get<FitnessConfig>(`${FITNESS_BASE}/config`);
  },

  /**
   * Update the fitness configuration
   */
  async updateConfig(config: UpdateFitnessConfigRequest): Promise<FitnessConfig> {
    return apiClient.put<FitnessConfig>(`${FITNESS_BASE}/config`, config);
  },

  /**
   * Reset fitness configuration to defaults
   */
  async resetConfig(): Promise<FitnessConfig> {
    return apiClient.post<FitnessConfig>(`${FITNESS_BASE}/config/reset`);
  },

  // =====================
  // Leaderboard
  // =====================

  /**
   * Get the fitness leaderboard
   */
  async getLeaderboard(
    taskType?: string,
    limit: number = 10
  ): Promise<ModelFitnessRanking[]> {
    const params = new URLSearchParams();
    if (taskType) params.append('taskType', taskType);
    params.append('limit', limit.toString());

    const queryString = params.toString();
    return apiClient.get<ModelFitnessRanking[]>(
      `${FITNESS_BASE}/leaderboard?${queryString}`
    );
  },

  // =====================
  // Model Profiles
  // =====================

  /**
   * Get all model profiles
   */
  async getProfiles(provider?: string): Promise<ModelProfile[]> {
    const params = new URLSearchParams();
    if (provider) params.append('provider', provider);

    const queryString = params.toString();
    const url = `${FITNESS_BASE}/profiles${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<ModelProfile[]>(url);
  },

  /**
   * Get a specific model profile
   */
  async getProfile(modelId: string): Promise<ModelProfile> {
    return apiClient.get<ModelProfile>(
      `${FITNESS_BASE}/profiles/${encodeURIComponent(modelId)}`
    );
  },

  /**
   * Create or update a model profile
   */
  async updateProfile(
    modelId: string,
    profile: UpdateModelProfileRequest
  ): Promise<ModelProfile> {
    return apiClient.put<ModelProfile>(
      `${FITNESS_BASE}/profiles/${encodeURIComponent(modelId)}`,
      profile
    );
  },

  /**
   * Delete a model profile
   */
  async deleteProfile(modelId: string): Promise<void> {
    return apiClient.delete(
      `${FITNESS_BASE}/profiles/${encodeURIComponent(modelId)}`
    );
  },

  /**
   * Initialize default model profiles
   */
  async initializeProfiles(): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(`${FITNESS_BASE}/profiles/initialize`);
  },

  // =====================
  // Task Entropy
  // =====================

  /**
   * Get task entropy for an entity
   */
  async getEntropy(
    entityId: string,
    entityType: 'model' | 'agent' = 'model'
  ): Promise<TaskEntropy> {
    const params = new URLSearchParams();
    params.append('entityType', entityType);

    return apiClient.get<TaskEntropy>(
      `${FITNESS_BASE}/entropy/${encodeURIComponent(entityId)}?${params.toString()}`
    );
  },

  /**
   * Get all task entropy records
   */
  async getAllEntropy(entityType?: 'model' | 'agent'): Promise<TaskEntropy[]> {
    const params = new URLSearchParams();
    if (entityType) params.append('entityType', entityType);

    const queryString = params.toString();
    const url = `${FITNESS_BASE}/entropy${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<TaskEntropy[]>(url);
  },

  /**
   * Record a task execution (updates entropy)
   */
  async recordTask(
    entityId: string,
    taskType: string,
    entityType: 'model' | 'agent' = 'model'
  ): Promise<TaskEntropy> {
    const params = new URLSearchParams();
    params.append('taskType', taskType);
    params.append('entityType', entityType);

    return apiClient.post<TaskEntropy>(
      `${FITNESS_BASE}/entropy/${encodeURIComponent(entityId)}/task?${params.toString()}`
    );
  },
};

export default fitnessService;
