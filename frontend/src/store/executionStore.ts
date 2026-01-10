/**
 * Execution Store (Zustand)
 *
 * Global state management for workflow executions.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { WorkflowExecution, ExecutionSummary, ExecutionEvent } from '../types';
import { executionService } from '../services/workflowService';

interface ExecutionState {
  // State
  currentExecution: WorkflowExecution | null;
  executionHistory: ExecutionSummary[];
  events: ExecutionEvent[];
  isLoading: boolean;
  error: string | null;

  // Actions
  startExecution: (workflowId: string) => Promise<void>;
  loadExecution: (executionId: string) => Promise<void>;
  pauseExecution: (executionId: string) => Promise<void>;
  resumeExecution: (executionId: string) => Promise<void>;
  cancelExecution: (executionId: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  addEvent: (event: ExecutionEvent) => void;
  clearEvents: () => void;
  clearError: () => void;
}

export const useExecutionStore = create<ExecutionState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentExecution: null,
      executionHistory: [],
      events: [],
      isLoading: false,
      error: null,

      // Start execution
      startExecution: async (workflowId: string) => {
        set({ isLoading: true, error: null });
        try {
          const execution = await executionService.execute(workflowId);
          set({ currentExecution: execution, isLoading: false, events: [] });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to start execution',
            isLoading: false,
          });
        }
      },

      // Load execution
      loadExecution: async (executionId: string) => {
        set({ isLoading: true, error: null });
        try {
          const execution = await executionService.getExecution(executionId);
          set({ currentExecution: execution, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load execution',
            isLoading: false,
          });
        }
      },

      // Pause execution
      pauseExecution: async (executionId: string) => {
        set({ isLoading: true, error: null });
        try {
          await executionService.pause(executionId);
          const currentExecution = get().currentExecution;
          if (currentExecution && currentExecution.id === executionId) {
            set({
              currentExecution: { ...currentExecution, status: 'Paused' },
              isLoading: false,
            });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to pause execution',
            isLoading: false,
          });
        }
      },

      // Resume execution
      resumeExecution: async (executionId: string) => {
        set({ isLoading: true, error: null });
        try {
          await executionService.resume(executionId);
          const currentExecution = get().currentExecution;
          if (currentExecution && currentExecution.id === executionId) {
            set({
              currentExecution: { ...currentExecution, status: 'Running' },
              isLoading: false,
            });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to resume execution',
            isLoading: false,
          });
        }
      },

      // Cancel execution
      cancelExecution: async (executionId: string) => {
        set({ isLoading: true, error: null });
        try {
          await executionService.cancel(executionId);
          const currentExecution = get().currentExecution;
          if (currentExecution && currentExecution.id === executionId) {
            set({
              currentExecution: { ...currentExecution, status: 'Cancelled' },
              isLoading: false,
            });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to cancel execution',
            isLoading: false,
          });
        }
      },

      // Load execution history
      loadHistory: async () => {
        set({ isLoading: true, error: null });
        try {
          const history = await executionService.getHistory();
          set({ executionHistory: history, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load history',
            isLoading: false,
          });
        }
      },

      // Add event from SignalR
      addEvent: (event: ExecutionEvent) => {
        const events = [...get().events, event];
        // Keep only last 1000 events to prevent memory issues
        if (events.length > 1000) {
          events.shift();
        }
        set({ events });
      },

      // Clear events
      clearEvents: () => {
        set({ events: [] });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'ExecutionStore' }
  )
);
