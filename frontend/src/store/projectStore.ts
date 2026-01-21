/**
 * Project Store
 * 
 * Zustand store for managing Maestro projects.
 * Phase 7E implementation.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../services/api';

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
  
  // UI State
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  
  // Actions
  fetchProjects: () => Promise<void>;
  getProject: (id: string) => Promise<Project | null>;
  createProject: (request: CreateProjectRequest) => Promise<Project>;
  updateProject: (id: string, request: UpdateProjectRequest) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  openProject: (path: string) => Promise<Project>;
  discoverProjects: (searchPath: string) => Promise<Project[]>;
  
  // Current project management
  setCurrentProject: (project: Project | null) => void;
  clearError: () => void;
}

// ============= Store =============

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, _get) => ({
      // Initial state
      projects: [],
      currentProject: null,
      isLoading: false,
      error: null,
      lastFetched: null,

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
          
          // Update cache
          set(state => ({
            projects: state.projects.map(p => p.id === id ? project : p),
            isLoading: false
          }));
          
          return project;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch project';
          set({ error: message, isLoading: false });
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
          const project = await apiClient.post<Project>('/api/projects/open', { path });
          
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

      // Set current project
      setCurrentProject: (project: Project | null) => {
        set({ currentProject: project });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'maestro-projects',
      partialize: (state) => ({
        currentProject: state.currentProject,
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

export const selectProjectById = (id: string) => (state: ProjectState) =>
  state.projects.find(p => p.id === id);

export const selectProjectsByRuntime = (runtimeType: string) => (state: ProjectState) =>
  state.projects.filter(p => p.runtime?.type === runtimeType);

export default useProjectStore;
