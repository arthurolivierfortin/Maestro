/**
 * Test Store
 * Zustand store for block testing state management
 */

import { create } from 'zustand';
import { testService } from '../services/testService';
import type {
  BlockTestRun,
  BlockTestIteration,
  BlockTestRunComparison,
  CreateTestRunRequest,
  SubmitEvaluationRequest,
  TestRunFilter,
} from '../types/test.types';

interface TestState {
  // Data
  testRuns: BlockTestRun[];
  currentTestRun: BlockTestRun | null;
  pendingEvaluations: BlockTestIteration[];
  comparison: BlockTestRunComparison | null;

  // UI State
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  filter: TestRunFilter;

  // Actions - Data Loading
  loadTestRuns: (filter?: TestRunFilter) => Promise<void>;
  loadTestRun: (id: string) => Promise<void>;
  loadPendingEvaluations: (runId: string) => Promise<void>;
  loadComparison: (runIds: string[]) => Promise<void>;

  // Actions - Test Run Management
  createTestRun: (request: CreateTestRunRequest) => Promise<BlockTestRun>;
  deleteTestRun: (id: string) => Promise<void>;

  // Actions - Evaluation
  submitEvaluation: (runId: string, evaluation: SubmitEvaluationRequest) => Promise<void>;
  submitBulkEvaluation: (runId: string, evaluations: SubmitEvaluationRequest[]) => Promise<void>;
  submitImprovement: (runId: string, suggestions: string[]) => Promise<void>;

  // Actions - UI
  setFilter: (filter: TestRunFilter) => void;
  clearError: () => void;
  clearCurrentTestRun: () => void;

  // Actions - Real-time updates
  updateTestRun: (testRun: BlockTestRun) => void;
  addIteration: (runId: string, iteration: BlockTestIteration) => void;
}

export const useTestStore = create<TestState>((set, get) => ({
  // Initial state
  testRuns: [],
  currentTestRun: null,
  pendingEvaluations: [],
  comparison: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
  filter: {},

  // Load all test runs
  loadTestRuns: async (filter?: TestRunFilter) => {
    set({ isLoading: true, error: null });
    try {
      const effectiveFilter = filter ?? get().filter;
      const testRuns = await testService.getTestRuns(effectiveFilter);
      set({ testRuns, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load test runs',
        isLoading: false,
      });
    }
  },

  // Load a single test run
  loadTestRun: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const testRun = await testService.getTestRun(id);
      set({ currentTestRun: testRun, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load test run',
        isLoading: false,
      });
    }
  },

  // Load pending evaluations for a run
  loadPendingEvaluations: async (runId: string) => {
    set({ isLoading: true, error: null });
    try {
      const pendingEvaluations = await testService.getPendingEvaluations(runId);
      set({ pendingEvaluations, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load pending evaluations',
        isLoading: false,
      });
    }
  },

  // Load comparison data
  loadComparison: async (runIds: string[]) => {
    set({ isLoading: true, error: null });
    try {
      const comparison = await testService.compareTestRuns(runIds);
      set({ comparison, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load comparison',
        isLoading: false,
      });
    }
  },

  // Create a new test run
  createTestRun: async (request: CreateTestRunRequest) => {
    set({ isSubmitting: true, error: null });
    try {
      const testRun = await testService.createTestRun(request);
      set((state) => ({
        testRuns: [testRun, ...state.testRuns],
        currentTestRun: testRun,
        isSubmitting: false,
      }));
      return testRun;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create test run',
        isSubmitting: false,
      });
      throw error;
    }
  },

  // Delete a test run
  deleteTestRun: async (id: string) => {
    set({ isSubmitting: true, error: null });
    try {
      await testService.deleteTestRun(id);
      set((state) => ({
        testRuns: state.testRuns.filter((r) => r.id !== id),
        currentTestRun: state.currentTestRun?.id === id ? null : state.currentTestRun,
        isSubmitting: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete test run',
        isSubmitting: false,
      });
      throw error;
    }
  },

  // Submit evaluation for an iteration
  submitEvaluation: async (runId: string, evaluation: SubmitEvaluationRequest) => {
    set({ isSubmitting: true, error: null });
    try {
      const updatedRun = await testService.submitEvaluation(runId, evaluation);
      set((state) => ({
        testRuns: state.testRuns.map((r) => (r.id === runId ? updatedRun : r)),
        currentTestRun: state.currentTestRun?.id === runId ? updatedRun : state.currentTestRun,
        pendingEvaluations: state.pendingEvaluations.filter(
          (e) => e.id !== evaluation.iterationId
        ),
        isSubmitting: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to submit evaluation',
        isSubmitting: false,
      });
      throw error;
    }
  },

  // Submit bulk evaluations
  submitBulkEvaluation: async (runId: string, evaluations: SubmitEvaluationRequest[]) => {
    set({ isSubmitting: true, error: null });
    try {
      const updatedRun = await testService.submitBulkEvaluation(runId, evaluations);
      const evaluatedIds = new Set(evaluations.map((e) => e.iterationId));
      set((state) => ({
        testRuns: state.testRuns.map((r) => (r.id === runId ? updatedRun : r)),
        currentTestRun: state.currentTestRun?.id === runId ? updatedRun : state.currentTestRun,
        pendingEvaluations: state.pendingEvaluations.filter((e) => !evaluatedIds.has(e.id)),
        isSubmitting: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to submit evaluations',
        isSubmitting: false,
      });
      throw error;
    }
  },

  // Submit improvement suggestions
  submitImprovement: async (runId: string, suggestions: string[]) => {
    set({ isSubmitting: true, error: null });
    try {
      const updatedRun = await testService.submitImprovement(runId, suggestions);
      set((state) => ({
        testRuns: state.testRuns.map((r) => (r.id === runId ? updatedRun : r)),
        currentTestRun: state.currentTestRun?.id === runId ? updatedRun : state.currentTestRun,
        isSubmitting: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to submit improvement',
        isSubmitting: false,
      });
      throw error;
    }
  },

  // Set filter
  setFilter: (filter: TestRunFilter) => {
    set({ filter });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Clear current test run
  clearCurrentTestRun: () => {
    set({ currentTestRun: null, pendingEvaluations: [] });
  },

  // Real-time: Update a test run (from SignalR)
  updateTestRun: (testRun: BlockTestRun) => {
    set((state) => ({
      testRuns: state.testRuns.map((r) => (r.id === testRun.id ? testRun : r)),
      currentTestRun: state.currentTestRun?.id === testRun.id ? testRun : state.currentTestRun,
    }));
  },

  // Real-time: Add iteration to a test run (from SignalR)
  addIteration: (runId: string, iteration: BlockTestIteration) => {
    set((state) => {
      const updateRun = (run: BlockTestRun): BlockTestRun => ({
        ...run,
        iterations: [...run.iterations, iteration],
        completedIterations: run.completedIterations + 1,
      });

      return {
        testRuns: state.testRuns.map((r) => (r.id === runId ? updateRun(r) : r)),
        currentTestRun:
          state.currentTestRun?.id === runId
            ? updateRun(state.currentTestRun)
            : state.currentTestRun,
      };
    });
  },
}));

// Selectors
export const selectTestRuns = (state: TestState) => state.testRuns;
export const selectCurrentTestRun = (state: TestState) => state.currentTestRun;
export const selectPendingEvaluations = (state: TestState) => state.pendingEvaluations;
export const selectComparison = (state: TestState) => state.comparison;
export const selectIsLoading = (state: TestState) => state.isLoading;
export const selectIsSubmitting = (state: TestState) => state.isSubmitting;
export const selectError = (state: TestState) => state.error;

// Derived selectors
export const selectAwaitingEvaluationRuns = (state: TestState) =>
  state.testRuns.filter((r) => r.status === 'AwaitingEvaluation');

export const selectCompletedRuns = (state: TestState) =>
  state.testRuns.filter((r) => r.status === 'Completed');

export const selectRunsByBlockType = (blockType: string) => (state: TestState) =>
  state.testRuns.filter((r) => r.blockType === blockType);

export const selectRunsForBlock = (blockId: string) => (state: TestState) =>
  state.testRuns.filter((r) => r.blockId === blockId);

export default useTestStore;
