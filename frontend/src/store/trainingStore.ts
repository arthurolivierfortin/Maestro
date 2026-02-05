/**
 * Training Store (Zustand) - Phase 9
 *
 * Global state management for training runs and configurations.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  TrainingConfiguration,
  TrainingRun,
  TrainingRunSummary,
  CreateTrainingConfigRequest,
  StartTrainingRunRequest,
  TrainingDashboardStats,
} from '../types';
import { trainingService } from '../services/trainingService';

interface TrainingState {
  // State
  configurations: TrainingConfiguration[];
  currentConfiguration: TrainingConfiguration | null;
  runs: TrainingRunSummary[];
  currentRun: TrainingRun | null;
  dashboardStats: TrainingDashboardStats | null;
  isLoading: boolean;
  error: string | null;

  // Configuration actions
  loadConfigurations: () => Promise<void>;
  loadConfiguration: (id: string) => Promise<void>;
  createConfiguration: (config: CreateTrainingConfigRequest) => Promise<TrainingConfiguration>;
  updateConfiguration: (id: string, config: Partial<TrainingConfiguration>) => Promise<void>;
  deleteConfiguration: (id: string) => Promise<void>;

  // Run actions
  loadRuns: (limit?: number, offset?: number) => Promise<void>;
  loadRun: (id: string) => Promise<void>;
  loadRunsByConfiguration: (configurationId: string) => Promise<void>;
  startRun: (request: StartTrainingRunRequest) => Promise<TrainingRun>;
  pauseRun: (id: string) => Promise<void>;
  resumeRun: (id: string) => Promise<void>;
  cancelRun: (id: string) => Promise<void>;
  deleteRun: (id: string) => Promise<void>;

  // Dashboard actions
  loadDashboardStats: () => Promise<void>;

  // Utility actions
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  configurations: [],
  currentConfiguration: null,
  runs: [],
  currentRun: null,
  dashboardStats: null,
  isLoading: false,
  error: null,
};

export const useTrainingStore = create<TrainingState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // =====================
      // Configuration Actions
      // =====================

      loadConfigurations: async () => {
        set({ isLoading: true, error: null });
        try {
          const configurations = await trainingService.getConfigurations();
          set({ configurations, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load configurations',
            isLoading: false,
          });
        }
      },

      loadConfiguration: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const configuration = await trainingService.getConfiguration(id);
          set({ currentConfiguration: configuration, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load configuration',
            isLoading: false,
          });
        }
      },

      createConfiguration: async (config: CreateTrainingConfigRequest) => {
        set({ isLoading: true, error: null });
        try {
          const created = await trainingService.createConfiguration(config);
          const configurations = [...get().configurations, created];
          set({ configurations, currentConfiguration: created, isLoading: false });
          return created;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create configuration',
            isLoading: false,
          });
          throw error;
        }
      },

      updateConfiguration: async (id: string, config: Partial<TrainingConfiguration>) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await trainingService.updateConfiguration(id, config);
          const configurations = get().configurations.map((c) =>
            c.id === id ? updated : c
          );
          set({
            configurations,
            currentConfiguration: get().currentConfiguration?.id === id ? updated : get().currentConfiguration,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update configuration',
            isLoading: false,
          });
        }
      },

      deleteConfiguration: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          await trainingService.deleteConfiguration(id);
          const configurations = get().configurations.filter((c) => c.id !== id);
          set({
            configurations,
            currentConfiguration: get().currentConfiguration?.id === id ? null : get().currentConfiguration,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete configuration',
            isLoading: false,
          });
        }
      },

      // =====================
      // Run Actions
      // =====================

      loadRuns: async (limit?: number, offset?: number) => {
        set({ isLoading: true, error: null });
        try {
          const runs = await trainingService.getRuns(limit, offset);
          set({ runs, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load runs',
            isLoading: false,
          });
        }
      },

      loadRun: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const run = await trainingService.getRun(id);
          set({ currentRun: run, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load run',
            isLoading: false,
          });
        }
      },

      loadRunsByConfiguration: async (configurationId: string) => {
        set({ isLoading: true, error: null });
        try {
          const runs = await trainingService.getRunsByConfiguration(configurationId);
          set({ runs, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load runs',
            isLoading: false,
          });
        }
      },

      startRun: async (request: StartTrainingRunRequest) => {
        set({ isLoading: true, error: null });
        try {
          const run = await trainingService.startRun(request);
          const runs = [
            {
              id: run.id,
              name: run.name,
              workflowId: run.workflowId,
              status: run.status,
              totalIterations: run.totalIterations,
              completedIterations: run.completedIterations,
              failedIterations: run.failedIterations,
              startedAt: run.startedAt,
            } as TrainingRunSummary,
            ...get().runs,
          ];
          set({ runs, currentRun: run, isLoading: false });
          return run;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to start run',
            isLoading: false,
          });
          throw error;
        }
      },

      pauseRun: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const run = await trainingService.pauseRun(id);
          const runs = get().runs.map((r) =>
            r.id === id ? { ...r, status: run.status } : r
          );
          set({
            runs,
            currentRun: get().currentRun?.id === id ? run : get().currentRun,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to pause run',
            isLoading: false,
          });
        }
      },

      resumeRun: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const run = await trainingService.resumeRun(id);
          const runs = get().runs.map((r) =>
            r.id === id ? { ...r, status: run.status } : r
          );
          set({
            runs,
            currentRun: get().currentRun?.id === id ? run : get().currentRun,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to resume run',
            isLoading: false,
          });
        }
      },

      cancelRun: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const run = await trainingService.cancelRun(id);
          const runs = get().runs.map((r) =>
            r.id === id ? { ...r, status: run.status } : r
          );
          set({
            runs,
            currentRun: get().currentRun?.id === id ? run : get().currentRun,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to cancel run',
            isLoading: false,
          });
        }
      },

      deleteRun: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          await trainingService.deleteRun(id);
          const runs = get().runs.filter((r) => r.id !== id);
          set({
            runs,
            currentRun: get().currentRun?.id === id ? null : get().currentRun,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete run',
            isLoading: false,
          });
        }
      },

      // =====================
      // Dashboard Actions
      // =====================

      loadDashboardStats: async () => {
        set({ isLoading: true, error: null });
        try {
          const stats = await trainingService.getDashboardStats();
          set({ dashboardStats: stats, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load dashboard stats',
            isLoading: false,
          });
        }
      },

      // =====================
      // Utility Actions
      // =====================

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set(initialState);
      },
    }),
    { name: 'TrainingStore' }
  )
);
