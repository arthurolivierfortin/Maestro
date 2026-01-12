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
 * History entry for navigation
 */
interface HistoryEntry {
  path: string[];
  timestamp: number;
}

/**
 * Navigation State
 */
interface NavigationState {
  // State
  currentPath: string[]; // Array of block IDs representing navigation path
  selectedBlockId: string | null;
  propertiesPanelMode: PropertiesPanelMode; // Edit or view mode
  history: HistoryEntry[]; // Navigation history
  historyIndex: number; // Current position in history

  // Navigation actions
  navigateInto: (blockId: string) => void;
  navigateUp: () => void;
  navigateTo: (path: string[]) => void;
  navigateToRoot: () => void;
  navigateBack: () => boolean; // Returns true if navigation occurred
  navigateForward: () => boolean; // Returns true if navigation occurred

  // Selection actions
  selectBlock: (id: string | null, mode?: PropertiesPanelMode) => void;
  clearSelection: () => void;
  
  // Properties panel mode actions
  setPropertiesPanelMode: (mode: PropertiesPanelMode) => void;

  // Utility
  getCurrentBlockId: () => string | null;
  isAtRoot: () => boolean;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
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
      history: [{ path: [], timestamp: Date.now() }], // Start with root in history
      historyIndex: 0,

      // Helper to add to history
      _addToHistory: (path: string[]) => {
        const state = get();
        // Remove forward history if we navigate after going back
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        // Add new entry
        newHistory.push({ path: [...path], timestamp: Date.now() });
        // Limit history size to 50 entries
        const limitedHistory = newHistory.slice(-50);
        
        set({
          history: limitedHistory,
          historyIndex: limitedHistory.length - 1,
        });
      },

      // Navigate into a block (drill down)
      navigateInto: (blockId: string) => {
        set((state: NavigationState) => {
          const newPath = [...state.currentPath, blockId];
          (get() as any)._addToHistory(newPath);
          return {
            currentPath: newPath,
            selectedBlockId: null, // Clear selection when navigating
            propertiesPanelMode: 'view',
          };
        });
      },

      // Navigate up one level (go back)
      navigateUp: () => {
        set((state: NavigationState) => {
          if (state.currentPath.length === 0) return state;
          const newPath = state.currentPath.slice(0, -1);
          (get() as any)._addToHistory(newPath);
          return {
            currentPath: newPath,
            selectedBlockId: null,
            propertiesPanelMode: 'view',
          };
        });
      },

      // Navigate to specific path
      navigateTo: (path: string[]) => {
        (get() as any)._addToHistory(path);
        set({
          currentPath: [...path],
          selectedBlockId: null,
          propertiesPanelMode: 'view',
        });
      },

      // Navigate to root (clear path)
      navigateToRoot: () => {
        (get() as any)._addToHistory([]);
        set({
          currentPath: [],
          selectedBlockId: null,
          propertiesPanelMode: 'view',
        });
      },

      // Navigate back in history
      navigateBack: () => {
        const state = get();
        if (state.historyIndex > 0) {
          const newIndex = state.historyIndex - 1;
          const entry = state.history[newIndex];
          set({
            currentPath: [...entry.path],
            historyIndex: newIndex,
            selectedBlockId: null,
            propertiesPanelMode: 'view',
          });
          return true;
        }
        return false;
      },

      // Navigate forward in history
      navigateForward: () => {
        const state = get();
        if (state.historyIndex < state.history.length - 1) {
          const newIndex = state.historyIndex + 1;
          const entry = state.history[newIndex];
          set({
            currentPath: [...entry.path],
            historyIndex: newIndex,
            selectedBlockId: null,
            propertiesPanelMode: 'view',
          });
          return true;
        }
        return false;
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

      // Check if can go back
      canGoBack: () => {
        return get().historyIndex > 0;
      },

      // Check if can go forward
      canGoForward: () => {
        const state = get();
        return state.historyIndex < state.history.length - 1;
      },
    }),
    { name: 'NavigationStore' }
  )
);
