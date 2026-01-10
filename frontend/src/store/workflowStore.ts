/**
 * Workflow Store (Zustand)
 * 
 * Global state management for workflows.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Workflow, WorkflowSummary } from '@types';
import { workflowService } from '@services';

interface WorkflowState {
  // State
  workflows: WorkflowSummary[];
  currentWorkflow: Workflow | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadWorkflows: () => Promise<void>;
  loadWorkflow: (id: string) => Promise<void>;
  createWorkflow: (workflow: Workflow) => Promise<void>;
  updateWorkflow: (id: string, workflow: Workflow) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  setCurrentWorkflow: (workflow: Workflow | null) => void;
  clearError: () => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        workflows: [],
        currentWorkflow: null,
        isLoading: false,
        error: null,

        // Load all workflows
        loadWorkflows: async () => {
          set({ isLoading: true, error: null });
          try {
            const workflows = await workflowService.getAll();
            set({ workflows, isLoading: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to load workflows',
              isLoading: false,
            });
          }
        },

        // Load single workflow
        loadWorkflow: async (id: string) => {
          set({ isLoading: true, error: null });
          try {
            const workflow = await workflowService.getById(id);
            set({ currentWorkflow: workflow, isLoading: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to load workflow',
              isLoading: false,
            });
          }
        },

        // Create workflow
        createWorkflow: async (workflow: Workflow) => {
          set({ isLoading: true, error: null });
          try {
            const created = await workflowService.create(workflow);
            const workflows = [...get().workflows];
            workflows.push({
              id: created.id,
              name: created.name,
              description: created.description,
              version: created.version,
              nodeCount: created.nodes.length,
              tags: created.metadata.tags,
              createdAt: created.createdAt,
              updatedAt: created.updatedAt,
              lastExecutedAt: created.metadata.lastExecutedAt,
              executionCount: created.metadata.executionCount,
            });
            set({ workflows, currentWorkflow: created, isLoading: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to create workflow',
              isLoading: false,
            });
          }
        },

        // Update workflow
        updateWorkflow: async (id: string, workflow: Workflow) => {
          set({ isLoading: true, error: null });
          try {
            const updated = await workflowService.update(id, workflow);
            const workflows = get().workflows.map((w) =>
              w.id === id
                ? {
                    ...w,
                    name: updated.name,
                    description: updated.description,
                    version: updated.version,
                    nodeCount: updated.nodes.length,
                    updatedAt: updated.updatedAt,
                  }
                : w
            );
            set({ workflows, currentWorkflow: updated, isLoading: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to update workflow',
              isLoading: false,
            });
          }
        },

        // Delete workflow
        deleteWorkflow: async (id: string) => {
          set({ isLoading: true, error: null });
          try {
            await workflowService.delete(id);
            const workflows = get().workflows.filter((w) => w.id !== id);
            set({
              workflows,
              currentWorkflow: get().currentWorkflow?.id === id ? null : get().currentWorkflow,
              isLoading: false,
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to delete workflow',
              isLoading: false,
            });
          }
        },

        // Set current workflow
        setCurrentWorkflow: (workflow: Workflow | null) => {
          set({ currentWorkflow: workflow });
        },

        // Clear error
        clearError: () => {
          set({ error: null });
        },
      }),
      {
        name: 'workflow-store',
        partialize: (state) => ({
          // Only persist workflows list, not current workflow
          workflows: state.workflows,
        }),
      }
    ),
    { name: 'WorkflowStore' }
  )
);
