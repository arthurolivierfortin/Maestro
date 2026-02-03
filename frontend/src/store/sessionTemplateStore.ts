/**
 * Session Template Store (Zustand) - Phase 11
 *
 * Global state management for session templates.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  SessionTemplate,
  CreateSessionTemplateRequest,
  UpdateSessionTemplateRequest,
  TemplateSource,
  EnvironmentMode,
} from '../types/session.types';
import { sessionTemplateService } from '../services/sessionTemplateService';

interface SessionTemplateState {
  // State
  templates: SessionTemplate[];
  currentTemplate: SessionTemplate | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadTemplates: (params?: {
    source?: TemplateSource;
    mode?: EnvironmentMode;
    categoryId?: string;
    tags?: string[];
  }) => Promise<void>;
  loadBuiltIn: () => Promise<void>;
  loadUserDefined: () => Promise<void>;
  loadTemplate: (id: string) => Promise<void>;
  createTemplate: (request: CreateSessionTemplateRequest) => Promise<SessionTemplate>;
  updateTemplate: (id: string, request: UpdateSessionTemplateRequest) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  // Utility
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  templates: [],
  currentTemplate: null,
  isLoading: false,
  error: null,
};

export const useSessionTemplateStore = create<SessionTemplateState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadTemplates: async (params) => {
        set({ isLoading: true, error: null });
        try {
          const templates = await sessionTemplateService.getAll(params);
          set({ templates, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load session templates',
            isLoading: false,
          });
        }
      },

      loadBuiltIn: async () => {
        set({ isLoading: true, error: null });
        try {
          const templates = await sessionTemplateService.getBuiltIn();
          set({ templates, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load built-in templates',
            isLoading: false,
          });
        }
      },

      loadUserDefined: async () => {
        set({ isLoading: true, error: null });
        try {
          const templates = await sessionTemplateService.getUserDefined();
          set({ templates, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load user-defined templates',
            isLoading: false,
          });
        }
      },

      loadTemplate: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const template = await sessionTemplateService.getById(id);
          set({ currentTemplate: template, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load session template',
            isLoading: false,
          });
        }
      },

      createTemplate: async (request: CreateSessionTemplateRequest) => {
        set({ isLoading: true, error: null });
        try {
          const created = await sessionTemplateService.create(request);
          const templates = [...get().templates, created];
          set({ templates, currentTemplate: created, isLoading: false });
          return created;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create session template',
            isLoading: false,
          });
          throw error;
        }
      },

      updateTemplate: async (id: string, request: UpdateSessionTemplateRequest) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await sessionTemplateService.update(id, request);
          const templates = get().templates.map((t) => (t.id === id ? updated : t));
          set({
            templates,
            currentTemplate: get().currentTemplate?.id === id ? updated : get().currentTemplate,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update session template',
            isLoading: false,
          });
        }
      },

      deleteTemplate: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          await sessionTemplateService.delete(id);
          const templates = get().templates.filter((t) => t.id !== id);
          set({
            templates,
            currentTemplate: get().currentTemplate?.id === id ? null : get().currentTemplate,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete session template',
            isLoading: false,
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set(initialState);
      },
    }),
    { name: 'SessionTemplateStore' }
  )
);
