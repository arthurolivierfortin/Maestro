/**
 * Navigation Store (Zustand)
 *
 * Manages drill-down navigation state and block selection.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Properties panel mode
 */
export type PropertiesPanelMode = 'edit' | 'view';

/**
 * Navigation State
 */
interface NavigationState {
  // State
  currentPath: string[]; // Array of block IDs representing navigation path
  selectedBlockId: string | null;
  propertiesPanelMode: PropertiesPanelMode; // Edit or view mode

  // Navigation actions
  navigateInto: (blockId: string) => void;
  navigateUp: () => void;
  navigateTo: (path: string[]) => void;
  navigateToRoot: () => void;

  // Selection actions
  selectBlock: (id: string | null, mode?: PropertiesPanelMode) => void;
  clearSelection: () => void;
  
  // Properties panel mode actions
  setPropertiesPanelMode: (mode: PropertiesPanelMode) => void;

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
      propertiesPanelMode: 'view', // Default to view mode (read-only quick-view)

      // Navigate into a block (drill down)
      navigateInto: (blockId: string) => {
        set((state: NavigationState) => ({
          currentPath: [...state.currentPath, blockId],
          selectedBlockId: null, // Clear selection when navigating
          propertiesPanelMode: 'view',
        }));
      },

      // Navigate up one level (go back)
      navigateUp: () => {
        set((state: NavigationState) => {
          if (state.currentPath.length === 0) return state;
          return {
            currentPath: state.currentPath.slice(0, -1),
            selectedBlockId: null,
            propertiesPanelMode: 'view',
          };
        });
      },

      // Navigate to specific path
      navigateTo: (path: string[]) => {
        set({
          currentPath: [...path],
          selectedBlockId: null,
          propertiesPanelMode: 'view',
        });
      },

      // Navigate to root (clear path)
      navigateToRoot: () => {
        set({
          currentPath: [],
          selectedBlockId: null,
          propertiesPanelMode: 'view',
        });
      },

      // Select a block
      selectBlock: (id: string | null, mode: PropertiesPanelMode = 'view') => {
        set({ selectedBlockId: id, propertiesPanelMode: mode });
      },

      // Clear selection
      clearSelection: () => {
        set({ selectedBlockId: null, propertiesPanelMode: 'view' });
      },
      
      // Set properties panel mode
      setPropertiesPanelMode: (mode: PropertiesPanelMode) => {
        set({ propertiesPanelMode: mode });
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
