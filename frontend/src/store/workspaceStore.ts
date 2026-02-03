/**
 * Workspace Store (Zustand)
 *
 * Global state management for workspace operations, including CRUD,
 * session/project management, topology, and cross-workspace promotions.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Workspace,
  WorkspaceTopology,
  PromotionResult,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  PromoteAgentRequest,
  WorkspaceType,
} from '../types/workspace.types';
import { workspaceService } from '../services/workspaceService';

interface WorkspaceState {
  // State
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  topology: WorkspaceTopology | null;
  lastPromotion: PromotionResult | null;
  isLoading: boolean;
  error: string | null;

  // Workspace CRUD actions
  loadWorkspaces: (type?: WorkspaceType) => Promise<void>;
  loadWorkspace: (id: string) => Promise<void>;
  createWorkspace: (request: CreateWorkspaceRequest) => Promise<Workspace>;
  updateWorkspace: (id: string, request: UpdateWorkspaceRequest) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;

  // Session/Project management
  addSession: (workspaceId: string, sessionId: string) => Promise<void>;
  removeSession: (workspaceId: string, sessionId: string) => Promise<void>;
  addProject: (workspaceId: string, projectId: string) => Promise<void>;
  removeProject: (workspaceId: string, projectId: string) => Promise<void>;

  // Status actions
  pauseWorkspace: (id: string) => Promise<void>;
  resumeWorkspace: (id: string) => Promise<void>;
  archiveWorkspace: (id: string) => Promise<void>;

  // Topology actions
  loadTopology: () => Promise<void>;

  // Promotion actions
  promoteAgent: (sourceId: string, request: PromoteAgentRequest) => Promise<PromotionResult>;

  // Utility actions
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  workspaces: [],
  currentWorkspace: null,
  topology: null,
  lastPromotion: null,
  isLoading: false,
  error: null,
};

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // =====================
      // Workspace CRUD Actions
      // =====================

      loadWorkspaces: async (type?: WorkspaceType) => {
        set({ isLoading: true, error: null });
        try {
          const workspaces = await workspaceService.getWorkspaces(type);
          set({ workspaces, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load workspaces',
            isLoading: false,
          });
        }
      },

      loadWorkspace: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const workspace = await workspaceService.getWorkspace(id);
          set({ currentWorkspace: workspace, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load workspace',
            isLoading: false,
          });
        }
      },

      createWorkspace: async (request: CreateWorkspaceRequest) => {
        set({ isLoading: true, error: null });
        try {
          const workspace = await workspaceService.createWorkspace(request);
          const workspaces = [...get().workspaces, workspace];
          set({ workspaces, currentWorkspace: workspace, isLoading: false });
          return workspace;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create workspace',
            isLoading: false,
          });
          throw error;
        }
      },

      updateWorkspace: async (id: string, request: UpdateWorkspaceRequest) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await workspaceService.updateWorkspace(id, request);
          const workspaces = get().workspaces.map((w) =>
            w.id === id ? updated : w
          );
          set({
            workspaces,
            currentWorkspace: get().currentWorkspace?.id === id ? updated : get().currentWorkspace,
            isLoading: false,
          });
          return updated;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update workspace',
            isLoading: false,
          });
          throw error;
        }
      },

      deleteWorkspace: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          await workspaceService.deleteWorkspace(id);
          const workspaces = get().workspaces.filter((w) => w.id !== id);
          set({
            workspaces,
            currentWorkspace: get().currentWorkspace?.id === id ? null : get().currentWorkspace,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete workspace',
            isLoading: false,
          });
          throw error;
        }
      },

      // =====================
      // Session/Project Actions
      // =====================

      addSession: async (workspaceId: string, sessionId: string) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await workspaceService.addSession(workspaceId, sessionId);
          const workspaces = get().workspaces.map((w) =>
            w.id === workspaceId ? updated : w
          );
          set({
            workspaces,
            currentWorkspace: get().currentWorkspace?.id === workspaceId ? updated : get().currentWorkspace,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to add session',
            isLoading: false,
          });
          throw error;
        }
      },

      removeSession: async (workspaceId: string, sessionId: string) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await workspaceService.removeSession(workspaceId, sessionId);
          const workspaces = get().workspaces.map((w) =>
            w.id === workspaceId ? updated : w
          );
          set({
            workspaces,
            currentWorkspace: get().currentWorkspace?.id === workspaceId ? updated : get().currentWorkspace,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to remove session',
            isLoading: false,
          });
          throw error;
        }
      },

      addProject: async (workspaceId: string, projectId: string) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await workspaceService.addProject(workspaceId, projectId);
          const workspaces = get().workspaces.map((w) =>
            w.id === workspaceId ? updated : w
          );
          set({
            workspaces,
            currentWorkspace: get().currentWorkspace?.id === workspaceId ? updated : get().currentWorkspace,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to add project',
            isLoading: false,
          });
          throw error;
        }
      },

      removeProject: async (workspaceId: string, projectId: string) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await workspaceService.removeProject(workspaceId, projectId);
          const workspaces = get().workspaces.map((w) =>
            w.id === workspaceId ? updated : w
          );
          set({
            workspaces,
            currentWorkspace: get().currentWorkspace?.id === workspaceId ? updated : get().currentWorkspace,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to remove project',
            isLoading: false,
          });
          throw error;
        }
      },

      // =====================
      // Status Actions
      // =====================

      pauseWorkspace: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await workspaceService.pauseWorkspace(id);
          const workspaces = get().workspaces.map((w) =>
            w.id === id ? updated : w
          );
          set({
            workspaces,
            currentWorkspace: get().currentWorkspace?.id === id ? updated : get().currentWorkspace,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to pause workspace',
            isLoading: false,
          });
          throw error;
        }
      },

      resumeWorkspace: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await workspaceService.resumeWorkspace(id);
          const workspaces = get().workspaces.map((w) =>
            w.id === id ? updated : w
          );
          set({
            workspaces,
            currentWorkspace: get().currentWorkspace?.id === id ? updated : get().currentWorkspace,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to resume workspace',
            isLoading: false,
          });
          throw error;
        }
      },

      archiveWorkspace: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await workspaceService.archiveWorkspace(id);
          const workspaces = get().workspaces.map((w) =>
            w.id === id ? updated : w
          );
          set({
            workspaces,
            currentWorkspace: get().currentWorkspace?.id === id ? updated : get().currentWorkspace,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to archive workspace',
            isLoading: false,
          });
          throw error;
        }
      },

      // =====================
      // Topology Actions
      // =====================

      loadTopology: async () => {
        set({ isLoading: true, error: null });
        try {
          const topology = await workspaceService.getTopology();
          set({ topology, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load topology',
            isLoading: false,
          });
        }
      },

      // =====================
      // Promotion Actions
      // =====================

      promoteAgent: async (sourceId: string, request: PromoteAgentRequest) => {
        set({ isLoading: true, error: null });
        try {
          const result = await workspaceService.promoteAgent(sourceId, request);
          set({ lastPromotion: result, isLoading: false });
          return result;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to promote agent',
            isLoading: false,
          });
          throw error;
        }
      },

      // =====================
      // Utility Actions
      // =====================

      setCurrentWorkspace: (workspace: Workspace | null) => {
        set({ currentWorkspace: workspace });
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set(initialState);
      },
    }),
    { name: 'WorkspaceStore' }
  )
);
