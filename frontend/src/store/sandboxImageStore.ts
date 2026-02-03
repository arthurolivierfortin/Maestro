/**
 * Sandbox Image Store (Zustand) - Phase 11
 *
 * Global state management for sandbox images.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  SandboxImage,
  RegisterSandboxImageRequest,
  UpdateSandboxImageRequest,
  ImageSource,
} from '../types/session.types';
import { sandboxImageService } from '../services/sandboxImageService';

interface SandboxImageState {
  // State
  images: SandboxImage[];
  currentImage: SandboxImage | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadImages: (params?: { source?: ImageSource; verified?: boolean; tags?: string[] }) => Promise<void>;
  loadBuiltIn: () => Promise<void>;
  loadUserDefined: () => Promise<void>;
  loadImage: (id: string) => Promise<void>;
  registerImage: (request: RegisterSandboxImageRequest) => Promise<SandboxImage>;
  updateImage: (id: string, request: UpdateSandboxImageRequest) => Promise<void>;
  deleteImage: (id: string) => Promise<void>;
  verifyImage: (id: string) => Promise<void>;

  // Utility
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  images: [],
  currentImage: null,
  isLoading: false,
  error: null,
};

export const useSandboxImageStore = create<SandboxImageState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadImages: async (params) => {
        set({ isLoading: true, error: null });
        try {
          const images = await sandboxImageService.getAll(params);
          set({ images, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load sandbox images',
            isLoading: false,
          });
        }
      },

      loadBuiltIn: async () => {
        set({ isLoading: true, error: null });
        try {
          const images = await sandboxImageService.getBuiltIn();
          set({ images, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load built-in images',
            isLoading: false,
          });
        }
      },

      loadUserDefined: async () => {
        set({ isLoading: true, error: null });
        try {
          const images = await sandboxImageService.getUserDefined();
          set({ images, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load user-defined images',
            isLoading: false,
          });
        }
      },

      loadImage: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const image = await sandboxImageService.getById(id);
          set({ currentImage: image, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load sandbox image',
            isLoading: false,
          });
        }
      },

      registerImage: async (request: RegisterSandboxImageRequest) => {
        set({ isLoading: true, error: null });
        try {
          const created = await sandboxImageService.register(request);
          const images = [...get().images, created];
          set({ images, currentImage: created, isLoading: false });
          return created;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to register sandbox image',
            isLoading: false,
          });
          throw error;
        }
      },

      updateImage: async (id: string, request: UpdateSandboxImageRequest) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await sandboxImageService.update(id, request);
          const images = get().images.map((i) => (i.id === id ? updated : i));
          set({
            images,
            currentImage: get().currentImage?.id === id ? updated : get().currentImage,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update sandbox image',
            isLoading: false,
          });
        }
      },

      deleteImage: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          await sandboxImageService.delete(id);
          const images = get().images.filter((i) => i.id !== id);
          set({
            images,
            currentImage: get().currentImage?.id === id ? null : get().currentImage,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete sandbox image',
            isLoading: false,
          });
        }
      },

      verifyImage: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await sandboxImageService.verify(id);
          if (result.success) {
            // Reload the image to get updated verification status
            const image = await sandboxImageService.getById(id);
            const images = get().images.map((i) => (i.id === id ? image : i));
            set({
              images,
              currentImage: get().currentImage?.id === id ? image : get().currentImage,
              isLoading: false,
            });
          } else {
            set({
              error: result.errorMessage || 'Verification failed',
              isLoading: false,
            });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to verify sandbox image',
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
    { name: 'SandboxImageStore' }
  )
);
