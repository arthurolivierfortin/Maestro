/**
 * Fitness Store (Zustand) - Phase 11
 *
 * Global state management for fitness calculations, model profiles, and rankings.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
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
import { fitnessService } from '../services/fitnessService';

interface FitnessState {
  // State
  config: FitnessConfig | null;
  profiles: ModelProfile[];
  currentProfile: ModelProfile | null;
  leaderboard: ModelFitnessRanking[];
  entropy: TaskEntropy[];
  currentEntropy: TaskEntropy | null;
  fitnessHistory: FitnessScore[];
  currentStats: AggregateFitnessStats | null;
  isLoading: boolean;
  error: string | null;

  // Config actions
  loadConfig: () => Promise<void>;
  updateConfig: (config: UpdateFitnessConfigRequest) => Promise<void>;
  resetConfig: () => Promise<void>;

  // Profile actions
  loadProfiles: (provider?: string) => Promise<void>;
  loadProfile: (modelId: string) => Promise<void>;
  updateProfile: (modelId: string, profile: UpdateModelProfileRequest) => Promise<void>;
  deleteProfile: (modelId: string) => Promise<void>;
  initializeProfiles: () => Promise<void>;

  // Leaderboard actions
  loadLeaderboard: (taskType?: string, limit?: number) => Promise<void>;

  // Entropy actions
  loadAllEntropy: (entityType?: 'model' | 'agent') => Promise<void>;
  loadEntropy: (entityId: string, entityType?: 'model' | 'agent') => Promise<void>;
  recordTask: (entityId: string, taskType: string, entityType?: 'model' | 'agent') => Promise<void>;

  // Fitness calculation actions
  calculateFitness: (request: CalculateFitnessRequest) => Promise<FitnessScore>;
  loadFitnessHistory: (modelId: string, taskType?: string, limit?: number) => Promise<void>;
  loadFitnessStats: (modelId: string, taskType?: string) => Promise<void>;

  // Utility actions
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  config: null,
  profiles: [],
  currentProfile: null,
  leaderboard: [],
  entropy: [],
  currentEntropy: null,
  fitnessHistory: [],
  currentStats: null,
  isLoading: false,
  error: null,
};

export const useFitnessStore = create<FitnessState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // =====================
      // Config Actions
      // =====================

      loadConfig: async () => {
        set({ isLoading: true, error: null });
        try {
          const config = await fitnessService.getConfig();
          set({ config, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load config',
            isLoading: false,
          });
        }
      },

      updateConfig: async (configUpdate: UpdateFitnessConfigRequest) => {
        set({ isLoading: true, error: null });
        try {
          const config = await fitnessService.updateConfig(configUpdate);
          set({ config, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update config',
            isLoading: false,
          });
        }
      },

      resetConfig: async () => {
        set({ isLoading: true, error: null });
        try {
          const config = await fitnessService.resetConfig();
          set({ config, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to reset config',
            isLoading: false,
          });
        }
      },

      // =====================
      // Profile Actions
      // =====================

      loadProfiles: async (provider?: string) => {
        set({ isLoading: true, error: null });
        try {
          const profiles = await fitnessService.getProfiles(provider);
          set({ profiles, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load profiles',
            isLoading: false,
          });
        }
      },

      loadProfile: async (modelId: string) => {
        set({ isLoading: true, error: null });
        try {
          const profile = await fitnessService.getProfile(modelId);
          set({ currentProfile: profile, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load profile',
            isLoading: false,
          });
        }
      },

      updateProfile: async (modelId: string, profileUpdate: UpdateModelProfileRequest) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await fitnessService.updateProfile(modelId, profileUpdate);
          const profiles = get().profiles.map((p) =>
            p.modelId === modelId ? updated : p
          );
          // If profile doesn't exist in list, add it
          if (!profiles.find((p) => p.modelId === modelId)) {
            profiles.push(updated);
          }
          set({
            profiles,
            currentProfile: get().currentProfile?.modelId === modelId ? updated : get().currentProfile,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update profile',
            isLoading: false,
          });
        }
      },

      deleteProfile: async (modelId: string) => {
        set({ isLoading: true, error: null });
        try {
          await fitnessService.deleteProfile(modelId);
          const profiles = get().profiles.filter((p) => p.modelId !== modelId);
          set({
            profiles,
            currentProfile: get().currentProfile?.modelId === modelId ? null : get().currentProfile,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete profile',
            isLoading: false,
          });
        }
      },

      initializeProfiles: async () => {
        set({ isLoading: true, error: null });
        try {
          await fitnessService.initializeProfiles();
          // Reload profiles after initialization
          const profiles = await fitnessService.getProfiles();
          set({ profiles, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to initialize profiles',
            isLoading: false,
          });
        }
      },

      // =====================
      // Leaderboard Actions
      // =====================

      loadLeaderboard: async (taskType?: string, limit: number = 10) => {
        set({ isLoading: true, error: null });
        try {
          const leaderboard = await fitnessService.getLeaderboard(taskType, limit);
          set({ leaderboard, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load leaderboard',
            isLoading: false,
          });
        }
      },

      // =====================
      // Entropy Actions
      // =====================

      loadAllEntropy: async (entityType?: 'model' | 'agent') => {
        set({ isLoading: true, error: null });
        try {
          const entropy = await fitnessService.getAllEntropy(entityType);
          set({ entropy, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load entropy',
            isLoading: false,
          });
        }
      },

      loadEntropy: async (entityId: string, entityType: 'model' | 'agent' = 'model') => {
        set({ isLoading: true, error: null });
        try {
          const currentEntropy = await fitnessService.getEntropy(entityId, entityType);
          set({ currentEntropy, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load entropy',
            isLoading: false,
          });
        }
      },

      recordTask: async (entityId: string, taskType: string, entityType: 'model' | 'agent' = 'model') => {
        set({ isLoading: true, error: null });
        try {
          const updated = await fitnessService.recordTask(entityId, taskType, entityType);
          const entropy = get().entropy.map((e) =>
            e.entityId === entityId && e.entityType === entityType ? updated : e
          );
          // If entropy doesn't exist in list, add it
          if (!entropy.find((e) => e.entityId === entityId && e.entityType === entityType)) {
            entropy.push(updated);
          }
          set({
            entropy,
            currentEntropy:
              get().currentEntropy?.entityId === entityId &&
              get().currentEntropy?.entityType === entityType
                ? updated
                : get().currentEntropy,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to record task',
            isLoading: false,
          });
        }
      },

      // =====================
      // Fitness Calculation Actions
      // =====================

      calculateFitness: async (request: CalculateFitnessRequest) => {
        set({ isLoading: true, error: null });
        try {
          const score = await fitnessService.calculateFitness(request);
          // Add to history
          const fitnessHistory = [score, ...get().fitnessHistory.slice(0, 99)];
          set({ fitnessHistory, isLoading: false });
          return score;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to calculate fitness',
            isLoading: false,
          });
          throw error;
        }
      },

      loadFitnessHistory: async (modelId: string, taskType?: string, limit: number = 100) => {
        set({ isLoading: true, error: null });
        try {
          const fitnessHistory = await fitnessService.getFitnessHistory(modelId, taskType, limit);
          set({ fitnessHistory, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load fitness history',
            isLoading: false,
          });
        }
      },

      loadFitnessStats: async (modelId: string, taskType?: string) => {
        set({ isLoading: true, error: null });
        try {
          const currentStats = await fitnessService.getFitnessStats(modelId, taskType);
          set({ currentStats, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load fitness stats',
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
    { name: 'FitnessStore' }
  )
);
