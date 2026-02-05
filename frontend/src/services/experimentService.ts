/**
 * Experiment Service for Training Strategies Phase 7
 * Provides API client methods for experiment management
 */

import { apiClient } from './api';
import type {
  Experiment,
  CreateExperimentRequest,
  UpdateExperimentRequest,
  StrategyInfo,
  ExperimentComparison,
  ExperimentProgress,
  ExperimentStatus,
  StrategyCategory
} from '../types/experiment.types';

class ExperimentService {
  private baseUrl = '/experiments';

  /**
   * Get all experiments with optional filters
   */
  async getExperiments(options?: {
    workspaceId?: string;
    status?: ExperimentStatus;
    agentId?: string;
    strategyId?: string;
  }): Promise<Experiment[]> {
    const params = new URLSearchParams();
    if (options?.workspaceId) params.append('workspaceId', options.workspaceId);
    if (options?.status) params.append('status', options.status);
    if (options?.agentId) params.append('agentId', options.agentId);
    if (options?.strategyId) params.append('strategyId', options.strategyId);

    const query = params.toString();
    return apiClient.get<Experiment[]>(`${this.baseUrl}${query ? `?${query}` : ''}`);
  }

  /**
   * Get a single experiment by ID
   */
  async getExperiment(id: string): Promise<Experiment> {
    return apiClient.get<Experiment>(`${this.baseUrl}/${id}`);
  }

  /**
   * Create a new experiment
   */
  async createExperiment(request: CreateExperimentRequest): Promise<Experiment> {
    return apiClient.post<Experiment>(this.baseUrl, request);
  }

  /**
   * Update an experiment
   */
  async updateExperiment(id: string, request: UpdateExperimentRequest): Promise<Experiment> {
    return apiClient.put<Experiment>(`${this.baseUrl}/${id}`, request);
  }

  /**
   * Start an experiment
   */
  async startExperiment(id: string): Promise<Experiment> {
    return apiClient.post<Experiment>(`${this.baseUrl}/${id}/start`);
  }

  /**
   * Pause an experiment
   */
  async pauseExperiment(id: string): Promise<Experiment> {
    return apiClient.post<Experiment>(`${this.baseUrl}/${id}/pause`);
  }

  /**
   * Stop/cancel an experiment
   */
  async stopExperiment(id: string): Promise<Experiment> {
    return apiClient.post<Experiment>(`${this.baseUrl}/${id}/stop`);
  }

  /**
   * Delete an experiment
   */
  async deleteExperiment(id: string): Promise<void> {
    return apiClient.delete(`${this.baseUrl}/${id}`);
  }

  /**
   * Get experiment progress
   */
  async getProgress(id: string): Promise<ExperimentProgress> {
    return apiClient.get<ExperimentProgress>(`${this.baseUrl}/${id}/progress`);
  }

  /**
   * Get all available training strategies
   */
  async getStrategies(category?: StrategyCategory): Promise<StrategyInfo[]> {
    const query = category ? `?category=${category}` : '';
    return apiClient.get<StrategyInfo[]>(`${this.baseUrl}/strategies${query}`);
  }

  /**
   * Get a specific strategy by ID
   */
  async getStrategy(strategyId: string): Promise<StrategyInfo> {
    return apiClient.get<StrategyInfo>(`${this.baseUrl}/strategies/${strategyId}`);
  }

  /**
   * Compare multiple experiments
   */
  async compareExperiments(experimentIds: string[]): Promise<ExperimentComparison> {
    return apiClient.post<ExperimentComparison>(`${this.baseUrl}/compare`, { experimentIds });
  }

  /**
   * Start all pending experiments in a workspace
   */
  async startAllInWorkspace(workspaceId: string, parallel = true): Promise<{ started: string[]; skipped: string[] }> {
    const experiments = await this.getExperiments({ workspaceId });
    const toStart = experiments.filter(e =>
      e.status === 'Created' || e.status === 'Paused'
    );

    const started: string[] = [];
    const skipped: string[] = [];

    if (parallel) {
      const results = await Promise.allSettled(
        toStart.map(e => this.startExperiment(e.id))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          started.push(toStart[index].id);
        } else {
          skipped.push(toStart[index].id);
        }
      });
    } else {
      for (const exp of toStart) {
        try {
          await this.startExperiment(exp.id);
          started.push(exp.id);
        } catch {
          skipped.push(exp.id);
        }
      }
    }

    return { started, skipped };
  }

  /**
   * Get experiments grouped by status
   */
  async getExperimentsByStatus(workspaceId?: string): Promise<Record<ExperimentStatus, Experiment[]>> {
    const experiments = await this.getExperiments({ workspaceId });

    const grouped: Record<ExperimentStatus, Experiment[]> = {
      Created: [],
      Running: [],
      Paused: [],
      Completed: [],
      Failed: [],
      Cancelled: []
    };

    experiments.forEach(exp => {
      grouped[exp.status].push(exp);
    });

    return grouped;
  }

  /**
   * Get best strategy for a given task type
   */
  async recommendStrategy(taskType: string): Promise<StrategyInfo[]> {
    const strategies = await this.getStrategies();
    return strategies.filter(s =>
      s.suitableFor.some(t =>
        t.toLowerCase().includes(taskType.toLowerCase())
      )
    );
  }
}

export const experimentService = new ExperimentService();
