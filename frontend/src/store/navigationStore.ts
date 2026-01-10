/**
 * Navigation Store (Zustand)
 *
 * Manages drill-down navigation state and block selection.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Navigation State
 */
interface NavigationState {
  // State
  currentPath: string[]; // Array of block IDs representing navigation path
  selectedBlockId: string | null;

  // Navigation actions
  navigateInto: (blockId: string) => void;
  navigateUp: () => void;
  navigateTo: (path: string[]) => void;
  navigateToRoot: () => void;

  // Selection actions
  selectBlock: (id: string | null) => void;
  clearSelection: () => void;

  // Utility
  getCurrentBlockId: () => string | null;
  isAtRoot: () => boolean;
}

/**
 * Navigation Store
 */
export const useNavigationStore = create<NavigationState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentPath: [],
      selectedBlockId: null,

      // Navigate into a block (drill down)
      navigateInto: (blockId: string) => {
        set((state) => ({
          currentPath: [...state.currentPath, blockId],
          selectedBlockId: null, // Clear selection when navigating
        }));
      },

      // Navigate up one level (go back)
      navigateUp: () => {
        set((state) => {
          if (state.currentPath.length === 0) return state;
          return {
            currentPath: state.currentPath.slice(0, -1),
            selectedBlockId: null,
          };
        });
      },

      // Navigate to specific path
      navigateTo: (path: string[]) => {
        set({
          currentPath: [...path],
          selectedBlockId: null,
        });
      },

      // Navigate to root (clear path)
      navigateToRoot: () => {
        set({
          currentPath: [],
          selectedBlockId: null,
        });
      },

      // Select a block
      selectBlock: (id: string | null) => {
        set({ selectedBlockId: id });
      },

      // Clear selection
      clearSelection: () => {
        set({ selectedBlockId: null });
      },

      // Get current block ID (last in path)
      getCurrentBlockId: () => {
        const path = get().currentPath;
        return path.length > 0 ? path[path.length - 1] : null;
      },

      // Check if at root
      isAtRoot: () => {
        return get().currentPath.length === 0;
      },
    }),
    { name: 'NavigationStore' }
  )
);
