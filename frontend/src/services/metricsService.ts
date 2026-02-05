/**
 * Metrics Service (Phase 9)
 *
 * API service for workflow execution metrics.
 */

import { apiClient } from './api';
import type {
  WorkflowExecutionMetrics,
  AggregatedMetrics,
  MetricsQuery,
  MetricsDashboardSummary,
} from '../types';

const METRICS_BASE = '/api/metrics';

/**
 * Metrics API service
 */
export const metricsService = {
  /**
   * Get metrics for a specific execution
   */
  async getExecutionMetrics(executionId: string): Promise<WorkflowExecutionMetrics> {
    return apiClient.get<WorkflowExecutionMetrics>(`${METRICS_BASE}/execution/${executionId}`);
  },

  /**
   * Get metrics for a workflow
   */
  async getWorkflowMetrics(workflowId: string, query?: MetricsQuery): Promise<WorkflowExecutionMetrics[]> {
    const params = new URLSearchParams();
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.limit) params.append('limit', query.limit.toString());
    if (query?.offset) params.append('offset', query.offset.toString());
    if (query?.includeFailures !== undefined) params.append('includeFailures', query.includeFailures.toString());

    const queryString = params.toString();
    const url = `${METRICS_BASE}/workflow/${workflowId}${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<WorkflowExecutionMetrics[]>(url);
  },

  /**
   * Get aggregated metrics
   */
  async getAggregatedMetrics(query: MetricsQuery): Promise<AggregatedMetrics> {
    const params = new URLSearchParams();
    if (query.workflowId) params.append('workflowId', query.workflowId);
    if (query.startDate) params.append('startDate', query.startDate);
    if (query.endDate) params.append('endDate', query.endDate);
    if (query.tags) query.tags.forEach(tag => params.append('tags', tag));

    const queryString = params.toString();
    const url = `${METRICS_BASE}/aggregate${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<AggregatedMetrics>(url);
  },

  /**
   * Get recent metrics
   */
  async getRecentMetrics(limit: number = 10): Promise<WorkflowExecutionMetrics[]> {
    return apiClient.get<WorkflowExecutionMetrics[]>(`${METRICS_BASE}/recent?limit=${limit}`);
  },

  /**
   * Get dashboard summary
   */
  async getDashboardSummary(): Promise<MetricsDashboardSummary> {
    return apiClient.get<MetricsDashboardSummary>(`${METRICS_BASE}/dashboard`);
  },

  /**
   * Clean up old metrics
   */
  async cleanupOldMetrics(olderThan: string): Promise<{ deleted: number }> {
    return apiClient.delete<{ deleted: number }>(`${METRICS_BASE}/cleanup?olderThan=${olderThan}`);
  },

  /**
   * Export metrics to CSV
   */
  async exportMetrics(query: MetricsQuery): Promise<Blob> {
    const params = new URLSearchParams();
    if (query.workflowId) params.append('workflowId', query.workflowId);
    if (query.startDate) params.append('startDate', query.startDate);
    if (query.endDate) params.append('endDate', query.endDate);

    const queryString = params.toString();
    const url = `${METRICS_BASE}/export${queryString ? `?${queryString}` : ''}`;
    const response = await fetch(url);
    return response.blob();
  },
};

export default metricsService;
