/**
 * Experiment Store for Training Strategies Phase 7
 * Zustand store for experiment state management
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Experiment,
  StrategyInfo,
  CreateExperimentRequest,
  ExperimentComparison,
  ExperimentProgress,
  ExperimentStatus,
  StrategyCategory
} from '../types/experiment.types';
import { experimentService } from '../services/experimentService';

interface ExperimentState {
  // Data
  experiments: Experiment[];
  strategies: StrategyInfo[];
  comparison: ExperimentComparison | null;
  selectedExperiment: Experiment | null;
  progress: ExperimentProgress | null;

  // UI State
  isLoading: boolean;
  isLoadingStrategies: boolean;
  error: string | null;

  // Filters
  statusFilter: ExperimentStatus | null;
  workspaceFilter: string | null;
  categoryFilter: StrategyCategory | null;

  // Actions
  loadExperiments: (workspaceId?: string) => Promise<void>;
  loadStrategies: (category?: StrategyCategory) => Promise<void>;
  createExperiment: (request: CreateExperimentRequest) => Promise<Experiment>;
  startExperiment: (id: string) => Promise<void>;
  pauseExperiment: (id: string) => Promise<void>;
  stopExperiment: (id: string) => Promise<void>;
  deleteExperiment: (id: string) => Promise<void>;
  compareExperiments: (ids: string[]) => Promise<void>;
  loadProgress: (id: string) => Promise<void>;
  selectExperiment: (id: string | null) => void;
  startAllInWorkspace: (workspaceId: string, parallel?: boolean) => Promise<{ started: string[]; skipped: string[] }>;

  // Filter actions
  setStatusFilter: (status: ExperimentStatus | null) => void;
  setWorkspaceFilter: (workspaceId: string | null) => void;
  setCategoryFilter: (category: StrategyCategory | null) => void;

  // Utility
  clearError: () => void;
  clearComparison: () => void;
  getFilteredExperiments: () => Experiment[];
  getExperimentById: (id: string) => Experiment | undefined;
  getStrategyById: (id: string) => StrategyInfo | undefined;
}

export const useExperimentStore = create<ExperimentState>()(
  devtools(
    (set, get) => ({
      // Initial state
      experiments: [],
      strategies: [],
      comparison: null,
      selectedExperiment: null,
      progress: null,
      isLoading: false,
      isLoadingStrategies: false,
      error: null,
      statusFilter: null,
      workspaceFilter: null,
      categoryFilter: null,

      // Load experiments
      loadExperiments: async (workspaceId?: string) => {
        set({ isLoading: true, error: null });
        try {
          const experiments = await experimentService.getExperiments({ workspaceId });
          set({ experiments, isLoading: false, workspaceFilter: workspaceId || null });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load experiments',
            isLoading: false
          });
        }
      },

      // Load strategies
      loadStrategies: async (category?: StrategyCategory) => {
        set({ isLoadingStrategies: true, error: null });
        try {
          const strategies = await experimentService.getStrategies(category);
          set({ strategies, isLoadingStrategies: false, categoryFilter: category || null });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load strategies',
            isLoadingStrategies: false
          });
        }
      },

      // Create experiment
      createExperiment: async (request: CreateExperimentRequest) => {
        set({ isLoading: true, error: null });
        try {
          const experiment = await experimentService.createExperiment(request);
          set(state => ({
            experiments: [experiment, ...state.experiments],
            isLoading: false
          }));
          return experiment;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create experiment',
            isLoading: false
          });
          throw error;
        }
      },

      // Start experiment
      startExperiment: async (id: string) => {
        try {
          const updated = await experimentService.startExperiment(id);
          set(state => ({
            experiments: state.experiments.map(e => e.id === id ? updated : e),
            selectedExperiment: state.selectedExperiment?.id === id ? updated : state.selectedExperiment
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to start experiment' });
          throw error;
        }
      },

      // Pause experiment
      pauseExperiment: async (id: string) => {
        try {
          const updated = await experimentService.pauseExperiment(id);
          set(state => ({
            experiments: state.experiments.map(e => e.id === id ? updated : e),
            selectedExperiment: state.selectedExperiment?.id === id ? updated : state.selectedExperiment
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to pause experiment' });
          throw error;
        }
      },

      // Stop experiment
      stopExperiment: async (id: string) => {
        try {
          const updated = await experimentService.stopExperiment(id);
          set(state => ({
            experiments: state.experiments.map(e => e.id === id ? updated : e),
            selectedExperiment: state.selectedExperiment?.id === id ? updated : state.selectedExperiment
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to stop experiment' });
          throw error;
        }
      },

      // Delete experiment
      deleteExperiment: async (id: string) => {
        try {
          await experimentService.deleteExperiment(id);
          set(state => ({
            experiments: state.experiments.filter(e => e.id !== id),
            selectedExperiment: state.selectedExperiment?.id === id ? null : state.selectedExperiment
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to delete experiment' });
          throw error;
        }
      },

      // Compare experiments
      compareExperiments: async (ids: string[]) => {
        set({ isLoading: true, error: null });
        try {
          const comparison = await experimentService.compareExperiments(ids);
          set({ comparison, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to compare experiments',
            isLoading: false
          });
        }
      },

      // Load progress
      loadProgress: async (id: string) => {
        try {
          const progress = await experimentService.getProgress(id);
          set({ progress });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to load progress' });
        }
      },

      // Select experiment
      selectExperiment: (id: string | null) => {
        if (id === null) {
          set({ selectedExperiment: null, progress: null });
        } else {
          const experiment = get().experiments.find(e => e.id === id) || null;
          set({ selectedExperiment: experiment });
        }
      },

      // Start all in workspace
      startAllInWorkspace: async (workspaceId: string, parallel = true) => {
        set({ isLoading: true, error: null });
        try {
          const result = await experimentService.startAllInWorkspace(workspaceId, parallel);
          // Reload experiments to get updated statuses
          await get().loadExperiments(workspaceId);
          set({ isLoading: false });
          return result;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to start experiments',
            isLoading: false
          });
          throw error;
        }
      },

      // Filter actions
      setStatusFilter: (status: ExperimentStatus | null) => set({ statusFilter: status }),
      setWorkspaceFilter: (workspaceId: string | null) => set({ workspaceFilter: workspaceId }),
      setCategoryFilter: (category: StrategyCategory | null) => set({ categoryFilter: category }),

      // Utility functions
      clearError: () => set({ error: null }),
      clearComparison: () => set({ comparison: null }),

      getFilteredExperiments: () => {
        const { experiments, statusFilter, workspaceFilter } = get();
        return experiments.filter(exp => {
          if (statusFilter && exp.status !== statusFilter) return false;
          if (workspaceFilter && exp.workspaceId !== workspaceFilter) return false;
          return true;
        });
      },

      getExperimentById: (id: string) => {
        return get().experiments.find(e => e.id === id);
      },

      getStrategyById: (id: string) => {
        return get().strategies.find(s => s.id === id);
      }
    }),
    { name: 'experiment-store' }
  )
);
