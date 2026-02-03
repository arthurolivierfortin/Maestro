/**
 * Session Category Store (Zustand) - Phase 11
 *
 * Global state management for user-defined session categories.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  SessionCategory,
  CreateSessionCategoryRequest,
  UpdateSessionCategoryRequest,
} from '../types/session.types';
import { sessionCategoryService } from '../services/sessionCategoryService';

interface SessionCategoryState {
  // State
  categories: SessionCategory[];
  currentCategory: SessionCategory | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadCategories: () => Promise<void>;
  loadBuiltInCategories: () => Promise<void>;
  loadUserDefinedCategories: () => Promise<void>;
  loadCategory: (id: string) => Promise<void>;
  createCategory: (request: CreateSessionCategoryRequest) => Promise<SessionCategory>;
  updateCategory: (id: string, request: UpdateSessionCategoryRequest) => Promise<SessionCategory>;
  deleteCategory: (id: string) => Promise<void>;

  // Utility
  getCategoryById: (id: string) => SessionCategory | undefined;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  categories: [],
  currentCategory: null,
  isLoading: false,
  error: null,
};

export const useSessionCategoryStore = create<SessionCategoryState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadCategories: async () => {
        set({ isLoading: true, error: null });
        try {
          const categories = await sessionCategoryService.getAll();
          set({ categories, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load categories',
            isLoading: false,
          });
        }
      },

      loadBuiltInCategories: async () => {
        set({ isLoading: true, error: null });
        try {
          const categories = await sessionCategoryService.getBuiltIn();
          set({ categories, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load built-in categories',
            isLoading: false,
          });
        }
      },

      loadUserDefinedCategories: async () => {
        set({ isLoading: true, error: null });
        try {
          const categories = await sessionCategoryService.getUserDefined();
          set({ categories, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load user-defined categories',
            isLoading: false,
          });
        }
      },

      loadCategory: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const category = await sessionCategoryService.getById(id);
          set({ currentCategory: category, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load category',
            isLoading: false,
          });
        }
      },

      createCategory: async (request: CreateSessionCategoryRequest) => {
        set({ isLoading: true, error: null });
        try {
          const created = await sessionCategoryService.create(request);
          const categories = [...get().categories, created].sort(
            (a, b) => a.displayOrder - b.displayOrder
          );
          set({ categories, currentCategory: created, isLoading: false });
          return created;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create category',
            isLoading: false,
          });
          throw error;
        }
      },

      updateCategory: async (id: string, request: UpdateSessionCategoryRequest) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await sessionCategoryService.update(id, request);
          const categories = get()
            .categories.map((c) => (c.id === id ? updated : c))
            .sort((a, b) => a.displayOrder - b.displayOrder);
          set({
            categories,
            currentCategory: get().currentCategory?.id === id ? updated : get().currentCategory,
            isLoading: false,
          });
          return updated;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update category',
            isLoading: false,
          });
          throw error;
        }
      },

      deleteCategory: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          await sessionCategoryService.delete(id);
          const categories = get().categories.filter((c) => c.id !== id);
          set({
            categories,
            currentCategory: get().currentCategory?.id === id ? null : get().currentCategory,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete category',
            isLoading: false,
          });
          throw error;
        }
      },

      getCategoryById: (id: string) => {
        return get().categories.find((c) => c.id === id);
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set(initialState);
      },
    }),
    { name: 'SessionCategoryStore' }
  )
);
