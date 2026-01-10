/**
 * useBlockActions Hook
 *
 * Convenience hook for block CRUD operations with common patterns.
 */

import { useBlockStore } from '../store/blockStore';
import { BlockTypeRegistry } from '../registry';
import type { Block, BlockType } from '../types/block.types';

/**
 * Block actions hook
 */
export function useBlockActions() {
  const store = useBlockStore();

  /**
   * Create a new block with defaults
   */
  const createBlock = (
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

    store.addBlock(parentId, block);
    return block;
  };

  /**
   * Update block name
   */
  const renameBlock = (id: string, name: string) => {
    store.updateBlock(id, { name });
  };

  /**
   * Update block position
   */
  const updateBlockPosition = (id: string, x: number, y: number) => {
    store.updateBlock(id, { position: { x, y } });
  };

  /**
   * Update block config
   */
  const updateBlockConfig = (id: string, config: Partial<Record<string, unknown>>) => {
    const block = store.getBlock(id);
    if (!block) return;

    store.updateBlock(id, {
      config: { ...block.config, ...config } as Block['config'],
    });
  };

  /**
   * Check if a block can be deleted
   */
  const canDeleteBlock = (id: string): boolean => {
    const rootBlock = store.getRootBlock();
    // Can't delete root block
    return id !== rootBlock?.id;
  };

  return {
    // Store methods
    ...store,
    // Custom methods
    createBlock,
    renameBlock,
    updateBlockPosition,
    updateBlockConfig,
    canDeleteBlock,
  };
}
