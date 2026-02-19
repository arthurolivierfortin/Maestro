/**
 * useBlockActions Hook
 *
 * Convenience hook for block CRUD operations with common patterns.
 * Uses individual selectors to avoid re-renders on unrelated state changes.
 */

import { useCallback } from 'react';
import { useBlockStore } from '../store/blockStore';
import { BlockTypeRegistry } from '../registry';
import type { Block, BlockType } from '../types/block.types';

/**
 * Block actions hook - uses stable selectors to prevent infinite re-renders
 */
export function useBlockActions() {
  // Select individual actions (these are stable references)
  const addBlock = useBlockStore((state) => state.addBlock);
  const removeBlock = useBlockStore((state) => state.removeBlock);
  const updateBlock = useBlockStore((state) => state.updateBlock);
  const moveBlock = useBlockStore((state) => state.moveBlock);
  const duplicateBlock = useBlockStore((state) => state.duplicateBlock);
  const getBlock = useBlockStore((state) => state.getBlock);
  const getBlockPath = useBlockStore((state) => state.getBlockPath);
  const getBlockChildren = useBlockStore((state) => state.getBlockChildren);
  const getRootBlock = useBlockStore((state) => state.getRootBlock);
  const addConnection = useBlockStore((state) => state.addConnection);
  const removeConnection = useBlockStore((state) => state.removeConnection);
  const getBlockConnections = useBlockStore((state) => state.getBlockConnections);
  const undo = useBlockStore((state) => state.undo);
  const redo = useBlockStore((state) => state.redo);
  const canUndo = useBlockStore((state) => state.canUndo);
  const canRedo = useBlockStore((state) => state.canRedo);
  const clear = useBlockStore((state) => state.clear);
  const setBlocks = useBlockStore((state) => state.setBlocks);
  const getAllBlocks = useBlockStore((state) => state.getAllBlocks);
  const getBlocksByType = useBlockStore((state) => state.getBlocksByType);
  const getBlocksByCapability = useBlockStore((state) => state.getBlocksByCapability);
  const searchBlocks = useBlockStore((state) => state.searchBlocks);
  const exportBlock = useBlockStore((state) => state.exportBlock);
  const importBlock = useBlockStore((state) => state.importBlock);

  /**
   * Create a new block with defaults
   */
  const createBlock = useCallback((
    type: BlockType,
    parentId: string | null,
    overrides?: Partial<Block>
  ): Block | null => {
    const defaultBlock = BlockTypeRegistry.getDefaultBlock(type);

    const block: Block = {
      ...defaultBlock,
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      parentId,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'user',
        tags: [],
      },
      ...overrides,
    } as Block;

    addBlock(parentId, block);
    return block;
  }, [addBlock]);

  /**
   * Update block name
   */
  const renameBlock = useCallback((id: string, name: string) => {
    updateBlock(id, { name });
  }, [updateBlock]);

  /**
   * Update block position
   */
  const updateBlockPosition = useCallback((id: string, x: number, y: number) => {
    updateBlock(id, { position: { x, y } });
  }, [updateBlock]);

  /**
   * Update block config
   */
  const updateBlockConfig = useCallback((id: string, config: Partial<Record<string, unknown>>) => {
    const block = getBlock(id);
    if (!block) return;

    updateBlock(id, {
      config: { ...block.config, ...config } as Block['config'],
    });
  }, [getBlock, updateBlock]);

  /**
   * Check if a block can be deleted
   */
  const canDeleteBlock = useCallback((id: string): boolean => {
    const rootBlock = getRootBlock();
    // Can't delete root block
    return id !== rootBlock?.id;
  }, [getRootBlock]);

  return {
    // Store methods (individually selected for stability)
    addBlock,
    removeBlock,
    updateBlock,
    moveBlock,
    duplicateBlock,
    getBlock,
    getBlockPath,
    getBlockChildren,
    getRootBlock,
    addConnection,
    removeConnection,
    getBlockConnections,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    setBlocks,
    getAllBlocks,
    getBlocksByType,
    getBlocksByCapability,
    searchBlocks,
    exportBlock,
    importBlock,
    // Custom methods
    createBlock,
    renameBlock,
    updateBlockPosition,
    updateBlockConfig,
    canDeleteBlock,
  };
}
