/**
 * Test Service
 * API calls for block testing and evaluation
 */

import { apiClient } from './api';
import type {
  BlockTestRun,
  BlockTestIteration,
  BlockTestRunComparison,
  CreateTestRunRequest,
  SubmitEvaluationRequest,
  TestRunFilter,
} from '../types/test.types';

const BASE_URL = '/api/blocktest';

export const testService = {
  /**
   * List all test runs with optional filtering
   */
  async getTestRuns(filter?: TestRunFilter): Promise<BlockTestRun[]> {
    const params = new URLSearchParams();
    if (filter?.blockId) params.set('blockId', filter.blockId);
    if (filter?.blockType) params.set('blockType', filter.blockType);
    if (filter?.status) params.set('status', filter.status);

    const queryString = params.toString();
    const url = `${BASE_URL}/runs${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<BlockTestRun[]>(url);
  },

  /**
   * Get a specific test run with all iterations
   */
  async getTestRun(id: string): Promise<BlockTestRun> {
    return apiClient.get<BlockTestRun>(`${BASE_URL}/runs/${id}`);
  },

  /**
   * Create and start a new test run
   */
  async createTestRun(request: CreateTestRunRequest): Promise<BlockTestRun> {
    return apiClient.post<BlockTestRun>(`${BASE_URL}/runs`, request);
  },

  /**
   * Submit evaluation for a single iteration
   */
  async submitEvaluation(runId: string, evaluation: SubmitEvaluationRequest): Promise<BlockTestRun> {
    return apiClient.post<BlockTestRun>(`${BASE_URL}/runs/${runId}/evaluate`, evaluation);
  },

  /**
   * Submit bulk evaluations for multiple iterations
   */
  async submitBulkEvaluation(runId: string, evaluations: SubmitEvaluationRequest[]): Promise<BlockTestRun> {
    return apiClient.post<BlockTestRun>(`${BASE_URL}/runs/${runId}/evaluate/bulk`, { evaluations });
  },

  /**
   * Get iterations pending evaluation
   */
  async getPendingEvaluations(runId: string): Promise<BlockTestIteration[]> {
    return apiClient.get<BlockTestIteration[]>(`${BASE_URL}/runs/${runId}/pending`);
  },

  /**
   * Submit improvement suggestions for a test run
   */
  async submitImprovement(runId: string, suggestions: string[]): Promise<BlockTestRun> {
    return apiClient.post<BlockTestRun>(`${BASE_URL}/runs/${runId}/improve`, { suggestions });
  },

  /**
   * Compare multiple test runs
   */
  async compareTestRuns(runIds: string[]): Promise<BlockTestRunComparison> {
    return apiClient.get<BlockTestRunComparison>(`${BASE_URL}/compare?runIds=${runIds.join(',')}`);
  },

  /**
   * Delete a test run
   */
  async deleteTestRun(id: string): Promise<void> {
    return apiClient.delete(`${BASE_URL}/runs/${id}`);
  },

  /**
   * Get test runs for a specific block (convenience method)
   */
  async getTestRunsForBlock(blockId: string): Promise<BlockTestRun[]> {
    return this.getTestRuns({ blockId });
  },

  /**
   * Get recent test runs (last N)
   */
  async getRecentTestRuns(limit: number = 10): Promise<BlockTestRun[]> {
    const runs = await this.getTestRuns();
    return runs.slice(0, limit);
  },

  /**
   * Get test runs awaiting evaluation
   */
  async getAwaitingEvaluation(): Promise<BlockTestRun[]> {
    return this.getTestRuns({ status: 'AwaitingEvaluation' });
  },
};

export default testService;
