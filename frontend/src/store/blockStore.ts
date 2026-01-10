/**
 * Block Store (Zustand)
 *
 * Global state management for blocks with undo/redo support.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Block } from '../types/block.types';
import { BlockTypeRegistry } from '../registry';

/**
 * History entry for undo/redo
 */
interface HistoryEntry {
  blocks: Map<string, Block>;
  rootId: string | null;
}

/**
 * Block Store State
 */
interface BlockState {
  // State
  blocks: Map<string, Block>;
  rootId: string | null;
  history: HistoryEntry[];
  historyIndex: number;
  maxHistorySize: number;

  // Block CRUD operations
  addBlock: (parentId: string | null, block: Block) => void;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  moveBlock: (id: string, newParentId: string | null) => void;
  duplicateBlock: (id: string) => Block | null;

  // Block tree navigation
  getBlock: (id: string) => Block | undefined;
  getBlockPath: (id: string) => string[];
  getBlockChildren: (id: string) => Block[];
  getRootBlock: () => Block | null;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Utility
  clear: () => void;
  setBlocks: (blocks: Map<string, Block>, rootId: string | null) => void;
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone a block with new IDs
 */
function cloneBlockWithNewIds(block: Block): Block {
  const newId = generateId();
  const newBlock: Block = {
    ...block,
    id: newId,
    children: block.children?.map((child) => cloneBlockWithNewIds(child)),
    metadata: {
      ...block.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
  return newBlock;
}

/**
 * Create metadata for a new block
 */
function createMetadata(createdBy: string = 'user') {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    updatedAt: now,
    createdBy,
    tags: [],
  };
}

/**
 * Save history entry
 */
function saveHistory(
  state: BlockState,
  blocks: Map<string, Block>,
  rootId: string | null
): Partial<BlockState> {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push({ blocks: new Map(blocks), rootId });

  // Limit history size
  if (newHistory.length > state.maxHistorySize) {
    newHistory.shift();
  }

  return {
    blocks,
    rootId,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

/**
 * Block Store
 */
export const useBlockStore = create<BlockState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        blocks: new Map(),
        rootId: null,
        history: [],
        historyIndex: -1,
        maxHistorySize: 50,

        // Add block
        addBlock: (parentId: string | null, block: Block) => {
          const state = get();
          const blocks = new Map(state.blocks);

          // Ensure block has metadata
          if (!block.metadata) {
            block.metadata = createMetadata();
          }

          // If no parent, this becomes the root
          if (parentId === null) {
            blocks.set(block.id, { ...block, parentId: null });
            set(saveHistory(state, blocks, block.id));
            return;
          }

          // Find parent and add to its children
          const parent = blocks.get(parentId);
          if (!parent) {
            console.error(`Parent block ${parentId} not found`);
            return;
          }

          // Check if parent can contain this child
          if (!BlockTypeRegistry.canContain(parent.blockType, block.blockType)) {
            console.error(`Parent ${parent.blockType} cannot contain child ${block.blockType}`);
            return;
          }

          // Add block
          const updatedBlock = { ...block, parentId };
          blocks.set(block.id, updatedBlock);

          // Update parent's children
          const updatedParent = {
            ...parent,
            children: [...(parent.children || []), updatedBlock],
          };
          blocks.set(parentId, updatedParent);

          set(saveHistory(state, blocks, state.rootId));
        },

        // Remove block and all descendants
        removeBlock: (id: string) => {
          const state = get();
          const blocks = new Map(state.blocks);
          const block = blocks.get(id);

          if (!block) {
            console.error(`Block ${id} not found`);
            return;
          }

          // Remove all descendants recursively
          const removeRecursive = (blockId: string) => {
            const b = blocks.get(blockId);
            if (b?.children) {
              b.children.forEach((child) => removeRecursive(child.id));
            }
            blocks.delete(blockId);
          };

          removeRecursive(id);

          // Update parent's children
          if (block.parentId) {
            const parent = blocks.get(block.parentId);
            if (parent) {
              const updatedParent = {
                ...parent,
                children: parent.children?.filter((c) => c.id !== id) || [],
              };
              blocks.set(block.parentId, updatedParent);
            }
          }

          // If removing root, clear rootId
          const newRootId = id === state.rootId ? null : state.rootId;

          set(saveHistory(state, blocks, newRootId));
        },

        // Update block
        updateBlock: (id: string, updates: Partial<Block>) => {
          const state = get();
          const blocks = new Map(state.blocks);
          const block = blocks.get(id);

          if (!block) {
            console.error(`Block ${id} not found`);
            return;
          }

          const updatedBlock = {
            ...block,
            ...updates,
            metadata: {
              ...block.metadata,
              updatedAt: new Date().toISOString(),
            },
          };

          blocks.set(id, updatedBlock);

          // Update in parent's children
          if (block.parentId) {
            const parent = blocks.get(block.parentId);
            if (parent) {
              const updatedParent = {
                ...parent,
                children: parent.children?.map((c) => (c.id === id ? updatedBlock : c)) || [],
              };
              blocks.set(block.parentId, updatedParent);
            }
          }

          set(saveHistory(state, blocks, state.rootId));
        },

        // Move block to new parent
        moveBlock: (id: string, newParentId: string | null) => {
          const state = get();
          const blocks = new Map(state.blocks);
          const block = blocks.get(id);

          if (!block) {
            console.error(`Block ${id} not found`);
            return;
          }

          const oldParentId = block.parentId;

          // Can't move to itself or its descendants
          if (newParentId === id) {
            console.error('Cannot move block to itself');
            return;
          }

          // Check if newParent is a descendant
          if (newParentId) {
            const path = get().getBlockPath(newParentId);
            if (path.includes(id)) {
              console.error('Cannot move block to its descendant');
              return;
            }
          }

          // Check nesting rules
          if (newParentId) {
            const newParent = blocks.get(newParentId);
            if (!newParent) {
              console.error(`New parent ${newParentId} not found`);
              return;
            }
            if (!BlockTypeRegistry.canContain(newParent.blockType, block.blockType)) {
              console.error(
                `Parent ${newParent.blockType} cannot contain child ${block.blockType}`
              );
              return;
            }
          }

          // Remove from old parent
          if (oldParentId) {
            const oldParent = blocks.get(oldParentId);
            if (oldParent) {
              const updatedOldParent = {
                ...oldParent,
                children: oldParent.children?.filter((c) => c.id !== id) || [],
              };
              blocks.set(oldParentId, updatedOldParent);
            }
          }

          // Update block's parentId
          const updatedBlock = { ...block, parentId: newParentId };
          blocks.set(id, updatedBlock);

          // Add to new parent
          if (newParentId) {
            const newParent = blocks.get(newParentId);
            if (newParent) {
              const updatedNewParent = {
                ...newParent,
                children: [...(newParent.children || []), updatedBlock],
              };
              blocks.set(newParentId, updatedNewParent);
            }
          }

          set(saveHistory(state, blocks, state.rootId));
        },

        // Duplicate block
        duplicateBlock: (id: string) => {
          const state = get();
          const block = state.blocks.get(id);

          if (!block) {
            console.error(`Block ${id} not found`);
            return null;
          }

          const clonedBlock = cloneBlockWithNewIds(block);
          get().addBlock(block.parentId ?? null, clonedBlock);
          return clonedBlock;
        },

        // Get block
        getBlock: (id: string) => {
          return get().blocks.get(id);
        },

        // Get block path (array of ancestor IDs)
        getBlockPath: (id: string) => {
          const path: string[] = [];
          let currentId: string | null | undefined = id;

          while (currentId) {
            path.unshift(currentId);
            const block = get().blocks.get(currentId);
            currentId = block?.parentId;
          }

          return path;
        },

        // Get block children
        getBlockChildren: (id: string) => {
          const block = get().blocks.get(id);
          return block?.children || [];
        },

        // Get root block
        getRootBlock: () => {
          const state = get();
          if (!state.rootId) return null;
          return state.blocks.get(state.rootId) || null;
        },

        // Undo
        undo: () => {
          const state = get();
          if (state.historyIndex <= 0) return;

          const newIndex = state.historyIndex - 1;
          const entry = state.history[newIndex];

          set({
            blocks: new Map(entry.blocks),
            rootId: entry.rootId,
            historyIndex: newIndex,
          });
        },

        // Redo
        redo: () => {
          const state = get();
          if (state.historyIndex >= state.history.length - 1) return;

          const newIndex = state.historyIndex + 1;
          const entry = state.history[newIndex];

          set({
            blocks: new Map(entry.blocks),
            rootId: entry.rootId,
            historyIndex: newIndex,
          });
        },

        // Can undo
        canUndo: () => {
          return get().historyIndex > 0;
        },

        // Can redo
        canRedo: () => {
          const state = get();
          return state.historyIndex < state.history.length - 1;
        },

        // Clear all blocks
        clear: () => {
          set({
            blocks: new Map(),
            rootId: null,
            history: [],
            historyIndex: -1,
          });
        },

        // Set blocks (for loading)
        setBlocks: (blocks: Map<string, Block>, rootId: string | null) => {
          const state = get();
          set(saveHistory(state, blocks, rootId));
        },
      }),
      {
        name: 'block-store',
        partialize: (state) => ({
          blocks: Array.from(state.blocks.entries()),
          rootId: state.rootId,
        }),
        onRehydrateStorage: () => (state) => {
          if (state && Array.isArray(state.blocks)) {
            // Convert array back to Map
            state.blocks = new Map(state.blocks as [string, Block][]);
          }
        },
      }
    ),
    { name: 'BlockStore' }
  )
);
