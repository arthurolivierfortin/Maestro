/**
 * Training Service (Phase 9)
 *
 * API service for training runs and configurations.
 */

import { apiClient } from './api';
import type {
  TrainingConfiguration,
  TrainingRun,
  TrainingRunSummary,
  CreateTrainingConfigRequest,
  StartTrainingRunRequest,
  TrainingDashboardStats,
} from '../types';

const TRAINING_BASE = '/api/training';

/**
 * Training API service
 */
export const trainingService = {
  // =====================
  // Configuration APIs
  // =====================

  /**
   * Get all training configurations
   */
  async getConfigurations(): Promise<TrainingConfiguration[]> {
    return apiClient.get<TrainingConfiguration[]>(`${TRAINING_BASE}/configurations`);
  },

  /**
   * Get a specific configuration
   */
  async getConfiguration(id: string): Promise<TrainingConfiguration> {
    return apiClient.get<TrainingConfiguration>(`${TRAINING_BASE}/configurations/${id}`);
  },

  /**
   * Create a new training configuration
   */
  async createConfiguration(config: CreateTrainingConfigRequest): Promise<TrainingConfiguration> {
    return apiClient.post<TrainingConfiguration>(`${TRAINING_BASE}/configurations`, config);
  },

  /**
   * Update a training configuration
   */
  async updateConfiguration(id: string, config: Partial<TrainingConfiguration>): Promise<TrainingConfiguration> {
    return apiClient.put<TrainingConfiguration>(`${TRAINING_BASE}/configurations/${id}`, config);
  },

  /**
   * Delete a training configuration
   */
  async deleteConfiguration(id: string): Promise<void> {
    return apiClient.delete(`${TRAINING_BASE}/configurations/${id}`);
  },

  // =====================
  // Training Run APIs
  // =====================

  /**
   * Get all training runs
   */
  async getRuns(limit?: number, offset?: number): Promise<TrainingRunSummary[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    const queryString = params.toString();
    const url = `${TRAINING_BASE}/runs${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<TrainingRunSummary[]>(url);
  },

  /**
   * Get a specific training run
   */
  async getRun(id: string): Promise<TrainingRun> {
    return apiClient.get<TrainingRun>(`${TRAINING_BASE}/runs/${id}`);
  },

  /**
   * Get runs for a specific configuration
   */
  async getRunsByConfiguration(configurationId: string): Promise<TrainingRunSummary[]> {
    return apiClient.get<TrainingRunSummary[]>(`${TRAINING_BASE}/configurations/${configurationId}/runs`);
  },

  /**
   * Start a new training run
   */
  async startRun(request: StartTrainingRunRequest): Promise<TrainingRun> {
    return apiClient.post<TrainingRun>(`${TRAINING_BASE}/runs`, request);
  },

  /**
   * Pause a running training
   */
  async pauseRun(id: string): Promise<TrainingRun> {
    return apiClient.post<TrainingRun>(`${TRAINING_BASE}/runs/${id}/pause`);
  },

  /**
   * Resume a paused training
   */
  async resumeRun(id: string): Promise<TrainingRun> {
    return apiClient.post<TrainingRun>(`${TRAINING_BASE}/runs/${id}/resume`);
  },

  /**
   * Cancel a training run
   */
  async cancelRun(id: string): Promise<TrainingRun> {
    return apiClient.post<TrainingRun>(`${TRAINING_BASE}/runs/${id}/cancel`);
  },

  /**
   * Delete a training run
   */
  async deleteRun(id: string): Promise<void> {
    return apiClient.delete(`${TRAINING_BASE}/runs/${id}`);
  },

  // =====================
  // Dashboard APIs
  // =====================

  /**
   * Get training dashboard statistics
   */
  async getDashboardStats(): Promise<TrainingDashboardStats> {
    return apiClient.get<TrainingDashboardStats>(`${TRAINING_BASE}/dashboard`);
  },
};

export default trainingService;
