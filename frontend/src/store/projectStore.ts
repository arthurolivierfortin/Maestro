/**
 * Project Store
 *
 * Zustand store for managing Maestro projects.
 * Phase 8 enhanced with container state.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../services/api';
import { ContainerState, containerService } from '../services/containerService';

// ============= Types =============

export interface ResourceLimits {
  cpuLimit?: string;
  memoryLimit?: string;
  timeoutSeconds?: number;
}

export interface RuntimeConfig {
  type: string;
  image?: string;
  workDir?: string;
  environment?: Record<string, string>;
  resources?: ResourceLimits;
  networkMode?: string;
}

export interface FileAccessRule {
  path: string;
  type: 'file' | 'directory';
  permission: 'readwrite' | 'readonly' | 'hidden' | 'excluded';
  reason?: string;
}

export interface BlockPermission {
  blockPattern: string;
  permission: 'allowed' | 'denied' | 'requiresapproval';
  reason?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  rootPath: string;
  version: string;
  runtime?: RuntimeConfig;
  blockSearchPaths?: string[];
  defaultModel?: string;
  modelOverrides?: Record<string, string>;
  fileAccessRules?: FileAccessRule[];
  blockPermissions?: BlockPermission[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  rootPath: string;
  description?: string;
  runtime?: Partial<RuntimeConfig>;
  blockSearchPaths?: string[];
  defaultModel?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  runtime?: Partial<RuntimeConfig>;
  blockSearchPaths?: string[];
  defaultModel?: string;
  modelOverrides?: Record<string, string>;
}

export interface ProjectState {
  // Data
  projects: Project[];
  currentProject: Project | null;
  containerStates: Record<string, ContainerState>;

  // UI State
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  statusFilter: 'all' | 'running' | 'stopped';

  // Project Actions
  fetchProjects: () => Promise<void>;
  getProject: (id: string) => Promise<Project | null>;
  createProject: (request: CreateProjectRequest) => Promise<Project>;
  updateProject: (id: string, request: UpdateProjectRequest) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  openProject: (path: string) => Promise<Project>;
  discoverProjects: (searchPath: string) => Promise<Project[]>;

  // Container Actions
  fetchContainerStatus: (projectId: string) => Promise<ContainerState>;
  startContainer: (projectId: string) => Promise<ContainerState>;
  stopContainer: (projectId: string) => Promise<ContainerState>;
  restartContainer: (projectId: string) => Promise<ContainerState>;
  updateContainerState: (state: ContainerState) => void;

  // File Rules & Block Permissions
  updateFileRules: (projectId: string, rules: FileAccessRule[]) => Promise<FileAccessRule[]>;
  updateBlockPermissions: (projectId: string, permissions: BlockPermission[]) => Promise<BlockPermission[]>;

  // UI Actions
  setCurrentProject: (project: Project | null) => void;
  setStatusFilter: (filter: 'all' | 'running' | 'stopped') => void;
  clearError: () => void;
}

// ============= Store =============

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: [],
      currentProject: null,
      containerStates: {},
      isLoading: false,
      error: null,
      lastFetched: null,
      statusFilter: 'all',

      // Fetch all projects
      fetchProjects: async () => {
        set({ isLoading: true, error: null });
        try {
          const projects = await apiClient.get<Project[]>('/api/projects');
          set({
            projects,
            isLoading: false,
            lastFetched: Date.now()
          });

          // Fetch container states for all projects with runtime
          const projectsWithRuntime = projects.filter(p => p.runtime && p.runtime.type !== 'none');
          for (const project of projectsWithRuntime) {
            get().fetchContainerStatus(project.id).catch(() => {
              // Ignore errors for individual status fetches
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch projects';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      // Get single project
      getProject: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const project = await apiClient.get<Project>(`/api/projects/${id}`);

          // Update cache and set as current project
          set(state => ({
            projects: state.projects.map(p => p.id === id ? project : p),
            currentProject: project,
            isLoading: false
          }));

          return project;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch project';
          set({ error: message, isLoading: false, currentProject: null });
          return null;
        }
      },

      // Create new project
      createProject: async (request: CreateProjectRequest) => {
        set({ isLoading: true, error: null });
        try {
          const project = await apiClient.post<Project>('/api/projects', request);

          set(state => ({
            projects: [...state.projects, project],
            isLoading: false
          }));

          return project;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create project';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      // Update project
      updateProject: async (id: string, request: UpdateProjectRequest) => {
        set({ isLoading: true, error: null });
        try {
          const project = await apiClient.put<Project>(`/api/projects/${id}`, request);

          set(state => ({
            projects: state.projects.map(p => p.id === id ? project : p),
            currentProject: state.currentProject?.id === id ? project : state.currentProject,
            isLoading: false
          }));

          return project;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update project';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      // Delete project
      deleteProject: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.delete(`/api/projects/${id}`);

          set(state => ({
            projects: state.projects.filter(p => p.id !== id),
            currentProject: state.currentProject?.id === id ? null : state.currentProject,
            isLoading: false
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to delete project';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      // Open existing project from path
      openProject: async (path: string) => {
        set({ isLoading: true, error: null });
        try {
          const project = await apiClient.post<Project>('/api/projects/open', { rootPath: path });

          // Add to projects if not already present
          set(state => {
            const exists = state.projects.some(p => p.id === project.id);
            return {
              projects: exists
                ? state.projects.map(p => p.id === project.id ? project : p)
                : [...state.projects, project],
              currentProject: project,
              isLoading: false
            };
          });

          return project;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to open project';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      // Discover projects in directory
      discoverProjects: async (searchPath: string) => {
        set({ isLoading: true, error: null });
        try {
          const discovered = await apiClient.post<Project[]>('/api/projects/discover', { searchPath });

          // Merge discovered projects with existing
          set(state => {
            const existingIds = new Set(state.projects.map(p => p.id));
            const newProjects = discovered.filter(p => !existingIds.has(p.id));

            return {
              projects: [...state.projects, ...newProjects],
              isLoading: false
            };
          });

          return discovered;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to discover projects';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      // Container Actions
      fetchContainerStatus: async (projectId: string) => {
        try {
          const state = await containerService.getStatus(projectId);
          set(s => ({
            containerStates: { ...s.containerStates, [projectId]: state }
          }));
          return state;
        } catch {
          // Return stopped state if fetch fails
          const state: ContainerState = { projectId, status: 'stopped' };
          return state;
        }
      },

      startContainer: async (projectId: string) => {
        // Optimistically set to starting
        set(s => ({
          containerStates: {
            ...s.containerStates,
            [projectId]: { projectId, status: 'starting' }
          }
        }));

        try {
          const state = await containerService.start(projectId);
          set(s => ({
            containerStates: { ...s.containerStates, [projectId]: state }
          }));
          return state;
        } catch (error) {
          const errorState: ContainerState = {
            projectId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to start'
          };
          set(s => ({
            containerStates: { ...s.containerStates, [projectId]: errorState },
            error: errorState.error || null
          }));
          throw error;
        }
      },

      stopContainer: async (projectId: string) => {
        // Optimistically set to stopping
        set(s => ({
          containerStates: {
            ...s.containerStates,
            [projectId]: { ...s.containerStates[projectId], projectId, status: 'stopping' }
          }
        }));

        try {
          const state = await containerService.stop(projectId);
          set(s => ({
            containerStates: { ...s.containerStates, [projectId]: state }
          }));
          return state;
        } catch (error) {
          const errorState: ContainerState = {
            projectId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to stop'
          };
          set(s => ({
            containerStates: { ...s.containerStates, [projectId]: errorState },
            error: errorState.error || null
          }));
          throw error;
        }
      },

      restartContainer: async (projectId: string) => {
        set(s => ({
          containerStates: {
            ...s.containerStates,
            [projectId]: { projectId, status: 'stopping' }
          }
        }));

        try {
          const state = await containerService.restart(projectId);
          set(s => ({
            containerStates: { ...s.containerStates, [projectId]: state }
          }));
          return state;
        } catch (error) {
          const errorState: ContainerState = {
            projectId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to restart'
          };
          set(s => ({
            containerStates: { ...s.containerStates, [projectId]: errorState },
            error: errorState.error || null
          }));
          throw error;
        }
      },

      updateContainerState: (state: ContainerState) => {
        set(s => ({
          containerStates: { ...s.containerStates, [state.projectId]: state }
        }));
      },

      // File Rules & Block Permissions
      updateFileRules: async (projectId: string, rules: FileAccessRule[]) => {
        try {
          const updated = await apiClient.put<FileAccessRule[]>(
            `/api/projects/${projectId}/file-rules`,
            { rules }
          );

          // Update project in store
          set(state => ({
            projects: state.projects.map(p =>
              p.id === projectId ? { ...p, fileAccessRules: updated } : p
            ),
            currentProject: state.currentProject?.id === projectId
              ? { ...state.currentProject, fileAccessRules: updated }
              : state.currentProject
          }));

          return updated;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update file rules';
          set({ error: message });
          throw error;
        }
      },

      updateBlockPermissions: async (projectId: string, permissions: BlockPermission[]) => {
        try {
          const updated = await apiClient.put<BlockPermission[]>(
            `/api/projects/${projectId}/block-permissions`,
            { permissions }
          );

          // Update project in store
          set(state => ({
            projects: state.projects.map(p =>
              p.id === projectId ? { ...p, blockPermissions: updated } : p
            ),
            currentProject: state.currentProject?.id === projectId
              ? { ...state.currentProject, blockPermissions: updated }
              : state.currentProject
          }));

          return updated;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update permissions';
          set({ error: message });
          throw error;
        }
      },

      // UI Actions
      setCurrentProject: (project: Project | null) => {
        set({ currentProject: project });
      },

      setStatusFilter: (filter: 'all' | 'running' | 'stopped') => {
        set({ statusFilter: filter });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'maestro-projects',
      partialize: (state) => ({
        currentProject: state.currentProject,
        statusFilter: state.statusFilter,
        // Don't persist projects list - always fetch fresh
      }),
    }
  )
);

// ============= Selectors =============

export const selectProjects = (state: ProjectState) => state.projects;
export const selectCurrentProject = (state: ProjectState) => state.currentProject;
export const selectIsLoading = (state: ProjectState) => state.isLoading;
export const selectError = (state: ProjectState) => state.error;
export const selectContainerStates = (state: ProjectState) => state.containerStates;

export const selectProjectById = (id: string) => (state: ProjectState) =>
  state.projects.find(p => p.id === id);

export const selectContainerState = (projectId: string) => (state: ProjectState) =>
  state.containerStates[projectId] || { projectId, status: 'stopped' as const };

export const selectProjectsByRuntime = (runtimeType: string) => (state: ProjectState) =>
  state.projects.filter(p => p.runtime?.type === runtimeType);

export const selectFilteredProjects = (state: ProjectState) => {
  const { projects, containerStates, statusFilter } = state;

  if (statusFilter === 'all') return projects;

  return projects.filter(p => {
    const containerState = containerStates[p.id];
    const isRunning = containerState?.status === 'running';
    return statusFilter === 'running' ? isRunning : !isRunning;
  });
};

export default useProjectStore;
