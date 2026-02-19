/**
 * Navigation Store (Zustand)
 *
 * Simple stack-based navigation for breadcrumb and drill-down.
 * 
 * Core concept: A navigation stack where each entry is a breadcrumb segment.
 * - First entry is always the origin page (Foundry, Workflows, etc.)
 * - Subsequent entries are blocks we've navigated into
 * - The URL is derived from the last entry in the stack
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { BreadcrumbSegment } from '../types/navigation.types';
import { useBlockStore } from './blockStore';
import { BlockTypeRegistry } from '../registry';

/**
 * Properties panel mode
 */
export type PropertiesPanelMode = 'edit' | 'view';

/**
 * Stack entry representing a navigation point
 */
export interface NavStackEntry {
  /** Type: 'page' for top-level pages, 'block' for blocks */
  type: 'page' | 'block';
  /** Unique identifier (page name or block ID) */
  id: string;
  /** Display label for breadcrumb */
  label: string;
  /** URL path */
  path: string;
  /** Block ID (only for block entries) */
  blockId?: string;
  /** Whether this is an atomic block (for routing) */
  isAtomic?: boolean;
}

/**
 * Navigation State
 */
interface NavigationState {
  // Core navigation stack
  navStack: NavStackEntry[];

  // Selection state
  selectedBlockId: string | null;
  propertiesPanelMode: PropertiesPanelMode;

  // Navigation actions
  /**
   * Push a page onto the stack (starts fresh navigation)
   */
  pushPage: (pageId: string, label: string, basePath: string) => void;

  /**
   * Push a block onto the stack (drill-down)
   */
  pushBlock: (blockId: string) => void;

  /**
   * Pop to a specific index in the stack (breadcrumb click)
   */
  popToIndex: (index: number) => void;

  /**
   * Pop one level (go up/back)
   */
  popOne: () => void;

  /**
   * Clear the entire stack
   */
  clearStack: () => void;

  /**
   * Initialize from URL (used by route sync)
   */
  initFromUrl: (pageId: string, pageLabel: string, basePath: string, blockId?: string) => void;

  // Selection actions
  selectBlock: (id: string | null, mode?: PropertiesPanelMode) => void;
  clearSelection: () => void;
  setPropertiesPanelMode: (mode: PropertiesPanelMode) => void;

  // Getters
  /** Get the current (last) block ID, if any */
  getCurrentBlockId: () => string | null;
  /** Get the current URL path */
  getCurrentPath: () => string;
  /** Get breadcrumb segments */
  getBreadcrumbSegments: () => BreadcrumbSegment[];
  /** Check if can go up */
  canGoUp: () => boolean;
  /** Get the last entry in the stack */
  getLastEntry: () => NavStackEntry | null;
}

/**
 * Navigation Store
 */
export const useNavigationStore = create<NavigationState>()(
  devtools(
    (set, get) => ({
      navStack: [],
      selectedBlockId: null,
      propertiesPanelMode: 'view',

      pushPage: (pageId: string, label: string, basePath: string) => {
        set({
          navStack: [{
            type: 'page',
            id: pageId,
            label,
            path: basePath,
          }],
          selectedBlockId: null,
          propertiesPanelMode: 'view',
        });
      },

      pushBlock: (blockId: string) => {
        const state = get();
        const block = useBlockStore.getState().getBlock(blockId);

        if (!block) {
          console.warn(`[NavigationStore] Block not found: ${blockId}`);
          return;
        }

        // Check if this block is already in the stack
        const existingIndex = state.navStack.findIndex(
          (e) => e.type === 'block' && e.blockId === blockId
        );

        if (existingIndex >= 0) {
          // Already in stack - navigate to that position instead of duplicating
          set({
            navStack: state.navStack.slice(0, existingIndex + 1),
            selectedBlockId: null,
            propertiesPanelMode: 'view',
          });
          return;
        }

        // Use canonical isAtomic from BlockTypeRegistry (source of truth)
        // This ensures correct routing even if block.isAtomic is incorrect
        const typeInfo = BlockTypeRegistry.get(block.blockType);
        const isAtomic = typeInfo?.isAtomic ?? block.isAtomic;

        // Determine URL path based on whether block is atomic
        const path = isAtomic
          ? `/foundry/${blockId}/edit`
          : `/canvas/${blockId}`;

        const newEntry: NavStackEntry = {
          type: 'block',
          id: blockId,
          label: block.name,
          path,
          blockId,
          isAtomic,
        };

        set({
          navStack: [...state.navStack, newEntry],
          selectedBlockId: null,
          propertiesPanelMode: 'view',
        });
      },

      popToIndex: (index: number) => {
        const state = get();
        if (index < 0 || index >= state.navStack.length) return;

        set({
          navStack: state.navStack.slice(0, index + 1),
          selectedBlockId: null,
          propertiesPanelMode: 'view',
        });
      },

      popOne: () => {
        const state = get();
        if (state.navStack.length <= 1) return;

        set({
          navStack: state.navStack.slice(0, -1),
          selectedBlockId: null,
          propertiesPanelMode: 'view',
        });
      },

      clearStack: () => {
        set({
          navStack: [],
          selectedBlockId: null,
          propertiesPanelMode: 'view',
        });
      },

      initFromUrl: (pageId: string, pageLabel: string, basePath: string, blockId?: string) => {
        const state = get();

        // Check if we're already at the right state to avoid unnecessary updates
        const currentPage = state.navStack[0];
        const currentBlockId = get().getCurrentBlockId();

        if (currentPage?.id === pageId && currentBlockId === (blockId || null)) {
          // Already at the right state
          return;
        }

        const newStack: NavStackEntry[] = [{
          type: 'page',
          id: pageId,
          label: pageLabel,
          path: basePath,
        }];

        if (blockId) {
          const block = useBlockStore.getState().getBlock(blockId);
          if (block) {
            // Use canonical isAtomic from BlockTypeRegistry (source of truth)
            const typeInfo = BlockTypeRegistry.get(block.blockType);
            const isAtomic = typeInfo?.isAtomic ?? block.isAtomic;

            const path = isAtomic
              ? `/foundry/${blockId}/edit`
              : `/canvas/${blockId}`;

            newStack.push({
              type: 'block',
              id: blockId,
              label: block.name,
              path,
              blockId,
              isAtomic,
            });
          }
        }

        set({
          navStack: newStack,
          selectedBlockId: null,
          propertiesPanelMode: 'view',
        });
      },

      selectBlock: (id: string | null, mode: PropertiesPanelMode = 'view') => {
        set({ selectedBlockId: id, propertiesPanelMode: mode });
      },

      clearSelection: () => {
        set({ selectedBlockId: null, propertiesPanelMode: 'view' });
      },

      setPropertiesPanelMode: (mode: PropertiesPanelMode) => {
        set({ propertiesPanelMode: mode });
      },

      getCurrentBlockId: () => {
        const stack = get().navStack;
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].type === 'block' && stack[i].blockId) {
            return stack[i].blockId!;
          }
        }
        return null;
      },

      getCurrentPath: () => {
        const stack = get().navStack;
        if (stack.length === 0) return '/';
        return stack[stack.length - 1].path;
      },

      getBreadcrumbSegments: () => {
        const state = get();
        const segments: BreadcrumbSegment[] = [];

        // Home is always first
        segments.push({
          type: 'home',
          label: 'Home',
          path: '/',
          isClickable: true,
          isCurrent: state.navStack.length === 0,
        });

        // Add stack entries
        state.navStack.forEach((entry, index) => {
          const isLast = index === state.navStack.length - 1;

          if (entry.type === 'page') {
            segments.push({
              type: 'route',
              label: entry.label,
              path: entry.path,
              isClickable: !isLast,
              isCurrent: isLast,
            });
          } else {
            // Get fresh block data for label and type
            const block = useBlockStore.getState().getBlock(entry.blockId!);
            segments.push({
              type: 'block',
              label: block?.name || entry.label,
              path: entry.path,
              blockId: entry.blockId,
              blockType: block?.blockType,
              isClickable: !isLast,
              isCurrent: isLast,
            });
          }
        });

        return segments;
      },

      canGoUp: () => {
        return get().navStack.length > 1;
      },

      getLastEntry: () => {
        const stack = get().navStack;
        return stack.length > 0 ? stack[stack.length - 1] : null;
      },
    }),
    { name: 'NavigationStore' }
  )
);
