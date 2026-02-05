/**
 * Metrics Store (Zustand) - Phase 9
 *
 * Global state management for workflow execution metrics.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  WorkflowExecutionMetrics,
  AggregatedMetrics,
  MetricsQuery,
  MetricsDashboardSummary,
} from '../types';
import { metricsService } from '../services/metricsService';

interface MetricsState {
  // State
  currentMetrics: WorkflowExecutionMetrics | null;
  workflowMetrics: WorkflowExecutionMetrics[];
  aggregatedMetrics: AggregatedMetrics | null;
  recentMetrics: WorkflowExecutionMetrics[];
  dashboardSummary: MetricsDashboardSummary | null;
  isLoading: boolean;
  error: string | null;

  // Query state
  currentQuery: MetricsQuery;

  // Actions
  loadExecutionMetrics: (executionId: string) => Promise<void>;
  loadWorkflowMetrics: (workflowId: string, query?: MetricsQuery) => Promise<void>;
  loadAggregatedMetrics: (query: MetricsQuery) => Promise<void>;
  loadRecentMetrics: (limit?: number) => Promise<void>;
  loadDashboardSummary: () => Promise<void>;
  cleanupOldMetrics: (olderThan: string) => Promise<number>;
  setQuery: (query: Partial<MetricsQuery>) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  currentMetrics: null,
  workflowMetrics: [],
  aggregatedMetrics: null,
  recentMetrics: [],
  dashboardSummary: null,
  isLoading: false,
  error: null,
  currentQuery: {},
};

export const useMetricsStore = create<MetricsState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Load metrics for a specific execution
      loadExecutionMetrics: async (executionId: string) => {
        set({ isLoading: true, error: null });
        try {
          const metrics = await metricsService.getExecutionMetrics(executionId);
          set({ currentMetrics: metrics, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load execution metrics',
            isLoading: false,
          });
        }
      },

      // Load metrics for a workflow
      loadWorkflowMetrics: async (workflowId: string, query?: MetricsQuery) => {
        set({ isLoading: true, error: null });
        try {
          const metrics = await metricsService.getWorkflowMetrics(workflowId, query);
          set({ workflowMetrics: metrics, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load workflow metrics',
            isLoading: false,
          });
        }
      },

      // Load aggregated metrics
      loadAggregatedMetrics: async (query: MetricsQuery) => {
        set({ isLoading: true, error: null });
        try {
          const metrics = await metricsService.getAggregatedMetrics(query);
          set({ aggregatedMetrics: metrics, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load aggregated metrics',
            isLoading: false,
          });
        }
      },

      // Load recent metrics
      loadRecentMetrics: async (limit: number = 10) => {
        set({ isLoading: true, error: null });
        try {
          const metrics = await metricsService.getRecentMetrics(limit);
          set({ recentMetrics: metrics, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load recent metrics',
            isLoading: false,
          });
        }
      },

      // Load dashboard summary
      loadDashboardSummary: async () => {
        set({ isLoading: true, error: null });
        try {
          const summary = await metricsService.getDashboardSummary();
          set({ dashboardSummary: summary, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load dashboard summary',
            isLoading: false,
          });
        }
      },

      // Cleanup old metrics
      cleanupOldMetrics: async (olderThan: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await metricsService.cleanupOldMetrics(olderThan);
          set({ isLoading: false });
          return result.deleted;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to cleanup metrics',
            isLoading: false,
          });
          return 0;
        }
      },

      // Set query parameters
      setQuery: (query: Partial<MetricsQuery>) => {
        set({ currentQuery: { ...get().currentQuery, ...query } });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Reset store
      reset: () => {
        set(initialState);
      },
    }),
    { name: 'MetricsStore' }
  )
);
