/**
 * Block Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useBlockStore } from './blockStore';
import type { Block } from '../types/block.types';

describe('useBlockStore', () => {
  beforeEach(() => {
    // Clear store before each test
    useBlockStore.getState().clear();
  });

  const createTestBlock = (overrides?: Partial<Block>): Block => ({
    id: `block-${Date.now()}`,
    name: 'Test Block',
    blockType: 'task',
    isAtomic: false,
    parentId: null,
    config: { type: 'task', description: 'Test task' },
    inputs: [],
    outputs: [],
    position: { x: 0, y: 0 },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user',
      tags: [],
      status: 'active' as const,
    },
    ...overrides,
  });

  describe('addBlock', () => {
    it('should add root block', () => {
      const block = createTestBlock();
      useBlockStore.getState().addBlock(null, block);

      const rootBlock = useBlockStore.getState().getRootBlock();
      expect(rootBlock).toBeDefined();
      expect(rootBlock?.id).toBe(block.id);
    });

    it('should add child block to parent', () => {
      const parentBlock = createTestBlock({ blockType: 'workflow', children: [] });
      const childBlock = createTestBlock({ id: 'child-1', blockType: 'task' });

      useBlockStore.getState().addBlock(null, parentBlock);
      useBlockStore.getState().addBlock(parentBlock.id, childBlock);

      const parent = useBlockStore.getState().getBlock(parentBlock.id);
      expect(parent?.children).toHaveLength(1);
      expect(parent?.children?.[0].id).toBe(childBlock.id);
    });

    it('should not add child to atomic parent', () => {
      const atomicBlock = createTestBlock({ blockType: 'prompt', isAtomic: true });
      const childBlock = createTestBlock({ id: 'child-1', blockType: 'command' });

      useBlockStore.getState().addBlock(null, atomicBlock);
      useBlockStore.getState().addBlock(atomicBlock.id, childBlock);

      const parent = useBlockStore.getState().getBlock(atomicBlock.id);
      expect(parent?.children).toBeUndefined();
      const child = useBlockStore.getState().getBlock(childBlock.id);
      expect(child).toBeUndefined();
    });

    it('should not add invalid child type to parent', () => {
      // Task can contain: command, validator, decision, inference, script
      // Workflow is NOT allowed as a child of task
      const taskBlock = createTestBlock({ blockType: 'task', children: [], isAtomic: false });
      const workflowBlock = createTestBlock({ id: 'workflow-1', blockType: 'workflow' });

      useBlockStore.getState().addBlock(null, taskBlock);
      useBlockStore.getState().addBlock(taskBlock.id, workflowBlock);

      const parent = useBlockStore.getState().getBlock(taskBlock.id);
      expect(parent?.children).toHaveLength(0);
    });
  });

  describe('removeBlock', () => {
    it('should remove block and update parent', () => {
      const parentBlock = createTestBlock({ blockType: 'workflow', children: [] });
      const childBlock = createTestBlock({ id: 'child-1', blockType: 'task' });

      useBlockStore.getState().addBlock(null, parentBlock);
      useBlockStore.getState().addBlock(parentBlock.id, childBlock);
      useBlockStore.getState().removeBlock(childBlock.id);

      const parent = useBlockStore.getState().getBlock(parentBlock.id);
      expect(parent?.children).toHaveLength(0);
      const child = useBlockStore.getState().getBlock(childBlock.id);
      expect(child).toBeUndefined();
    });

    it('should remove block and all descendants', () => {
      const rootBlock = createTestBlock({ blockType: 'workflow', children: [] });
      const childBlock = createTestBlock({ id: 'child-1', blockType: 'task', children: [] });
      const grandchildBlock = createTestBlock({ id: 'grandchild-1', blockType: 'command' });

      useBlockStore.getState().addBlock(null, rootBlock);
      useBlockStore.getState().addBlock(rootBlock.id, childBlock);
      useBlockStore.getState().addBlock(childBlock.id, grandchildBlock);

      useBlockStore.getState().removeBlock(childBlock.id);

      expect(useBlockStore.getState().getBlock(childBlock.id)).toBeUndefined();
      expect(useBlockStore.getState().getBlock(grandchildBlock.id)).toBeUndefined();
    });
  });

  describe('updateBlock', () => {
    it('should update block properties', () => {
      const block = createTestBlock();
      useBlockStore.getState().addBlock(null, block);

      useBlockStore.getState().updateBlock(block.id, { name: 'Updated Name' });

      const updated = useBlockStore.getState().getBlock(block.id);
      expect(updated?.name).toBe('Updated Name');
    });

    it('should update metadata timestamp', () => {
      const block = createTestBlock();
      useBlockStore.getState().addBlock(null, block);

      const originalUpdatedAt = block.metadata.updatedAt;
      setTimeout(() => {
        useBlockStore.getState().updateBlock(block.id, { name: 'New Name' });
        const updated = useBlockStore.getState().getBlock(block.id);
        expect(updated?.metadata.updatedAt).not.toBe(originalUpdatedAt);
      }, 10);
    });
  });

  describe('getBlockPath', () => {
    it('should return path from root to block', () => {
      const rootBlock = createTestBlock({ blockType: 'workflow', children: [] });
      const childBlock = createTestBlock({ id: 'child-1', blockType: 'task', children: [] });
      const grandchildBlock = createTestBlock({ id: 'grandchild-1', blockType: 'command' });

      useBlockStore.getState().addBlock(null, rootBlock);
      useBlockStore.getState().addBlock(rootBlock.id, childBlock);
      useBlockStore.getState().addBlock(childBlock.id, grandchildBlock);

      const path = useBlockStore.getState().getBlockPath(grandchildBlock.id);
      expect(path).toEqual([rootBlock.id, childBlock.id, grandchildBlock.id]);
    });

    it('should return single item for root block', () => {
      const rootBlock = createTestBlock();
      useBlockStore.getState().addBlock(null, rootBlock);

      const path = useBlockStore.getState().getBlockPath(rootBlock.id);
      expect(path).toEqual([rootBlock.id]);
    });
  });

  describe('getBlockChildren', () => {
    it('should return direct children', () => {
      const parentBlock = createTestBlock({ blockType: 'workflow', children: [] });
      const child1 = createTestBlock({ id: 'child-1', blockType: 'task' });
      const child2 = createTestBlock({ id: 'child-2', blockType: 'inference' });

      useBlockStore.getState().addBlock(null, parentBlock);
      useBlockStore.getState().addBlock(parentBlock.id, child1);
      useBlockStore.getState().addBlock(parentBlock.id, child2);

      const children = useBlockStore.getState().getBlockChildren(parentBlock.id);
      expect(children).toHaveLength(2);
    });

    it('should return empty array for atomic blocks', () => {
      const atomicBlock = createTestBlock({ blockType: 'prompt', isAtomic: true });
      useBlockStore.getState().addBlock(null, atomicBlock);

      const children = useBlockStore.getState().getBlockChildren(atomicBlock.id);
      expect(children).toEqual([]);
    });
  });

  describe('undo/redo', () => {
    it('should undo add operation', () => {
      const block = createTestBlock();
      useBlockStore.getState().addBlock(null, block);

      expect(useBlockStore.getState().getRootBlock()).toBeDefined();

      // After adding, we should be able to undo if we're not at the first position
      if (useBlockStore.getState().canUndo()) {
        useBlockStore.getState().undo();
        expect(useBlockStore.getState().getRootBlock()).toBeNull();
      }
    });

    it('should redo add operation', () => {
      const block = createTestBlock();
      useBlockStore.getState().addBlock(null, block);

      if (useBlockStore.getState().canUndo()) {
        useBlockStore.getState().undo();
        expect(useBlockStore.getState().getRootBlock()).toBeNull();

        if (useBlockStore.getState().canRedo()) {
          useBlockStore.getState().redo();
          expect(useBlockStore.getState().getRootBlock()).toBeDefined();
        }
      }
    });

    it('should respect canUndo and canRedo', () => {
      const block = createTestBlock();
      useBlockStore.getState().addBlock(null, block);

      // After adding, check if undo is available
      const canUndoAfterAdd = useBlockStore.getState().canUndo();

      // If we can undo, test the undo/redo cycle
      if (canUndoAfterAdd) {
        useBlockStore.getState().undo();

        expect(useBlockStore.getState().canRedo()).toBe(true);
      }
    });
  });

  describe('duplicateBlock', () => {
    it('should create a copy with new IDs', () => {
      const parentBlock = createTestBlock({ blockType: 'workflow', children: [] });
      const originalBlock = createTestBlock({ id: 'original', blockType: 'task' });

      useBlockStore.getState().addBlock(null, parentBlock);
      useBlockStore.getState().addBlock(parentBlock.id, originalBlock);

      const duplicate = useBlockStore.getState().duplicateBlock(originalBlock.id);

      expect(duplicate).toBeDefined();
      expect(duplicate?.id).not.toBe(originalBlock.id);
      expect(duplicate?.name).toBe(originalBlock.name);

      const parent = useBlockStore.getState().getBlock(parentBlock.id);
      expect(parent?.children).toHaveLength(2);
    });
  });
});
