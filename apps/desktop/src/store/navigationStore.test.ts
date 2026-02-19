/**
 * Navigation Store Tests
 *
 * Tests for the stack-based navigation store.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNavigationStore } from './navigationStore';

// Mock block store
vi.mock('./blockStore', () => ({
  useBlockStore: {
    getState: vi.fn(() => ({
      getBlock: (id: string) => ({
        id,
        name: `Block ${id}`,
        isAtomic: id.includes('atomic'),
        blockType: 'agent',
      }),
    })),
  },
}));

describe('useNavigationStore', () => {
  beforeEach(() => {
    // Reset to initial state
    useNavigationStore.setState({
      navStack: [],
      selectedBlockId: null,
      propertiesPanelMode: 'view',
    });
  });

  describe('pushPage', () => {
    it('should set a page as the base of the stack', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      const stack = useNavigationStore.getState().navStack;
      expect(stack).toHaveLength(1);
      expect(stack[0]).toEqual({
        type: 'page',
        id: 'foundry',
        label: 'Foundry',
        path: '/foundry',
      });
    });

    it('should clear selection when pushing a page', () => {
      useNavigationStore.getState().selectBlock('block-1');
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      expect(useNavigationStore.getState().selectedBlockId).toBeNull();
    });
  });

  describe('pushBlock', () => {
    it('should add a block to the stack', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      useNavigationStore.getState().pushBlock('block-1');
      const stack = useNavigationStore.getState().navStack;
      expect(stack).toHaveLength(2);
      expect(stack[1].type).toBe('block');
      expect(stack[1].blockId).toBe('block-1');
    });

    it('should determine correct path for atomic blocks', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      useNavigationStore.getState().pushBlock('atomic-block-1');
      const stack = useNavigationStore.getState().navStack;
      expect(stack[1].path).toBe('/foundry/atomic-block-1/edit');
      expect(stack[1].isAtomic).toBe(true);
    });

    it('should determine correct path for non-atomic blocks', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      useNavigationStore.getState().pushBlock('block-1');
      const stack = useNavigationStore.getState().navStack;
      expect(stack[1].path).toBe('/canvas/block-1');
      expect(stack[1].isAtomic).toBe(false);
    });

    it('should not duplicate blocks already in stack', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      useNavigationStore.getState().pushBlock('block-1');
      useNavigationStore.getState().pushBlock('block-2');
      useNavigationStore.getState().pushBlock('block-1'); // Already in stack
      const stack = useNavigationStore.getState().navStack;
      // Should pop to block-1 instead of duplicating
      expect(stack).toHaveLength(2);
      expect(stack[1].blockId).toBe('block-1');
    });
  });

  describe('popToIndex', () => {
    it('should pop to a specific index in the stack', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      useNavigationStore.getState().pushBlock('block-1');
      useNavigationStore.getState().pushBlock('block-2');
      useNavigationStore.getState().pushBlock('block-3');

      useNavigationStore.getState().popToIndex(1); // Pop to block-1
      const stack = useNavigationStore.getState().navStack;
      expect(stack).toHaveLength(2);
      expect(stack[1].blockId).toBe('block-1');
    });

    it('should clear selection when popping', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      useNavigationStore.getState().pushBlock('block-1');
      useNavigationStore.getState().selectBlock('some-block');
      useNavigationStore.getState().popToIndex(0);
      expect(useNavigationStore.getState().selectedBlockId).toBeNull();
    });
  });

  describe('popOne', () => {
    it('should remove the last item from the stack', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      useNavigationStore.getState().pushBlock('block-1');
      useNavigationStore.getState().pushBlock('block-2');

      useNavigationStore.getState().popOne();
      const stack = useNavigationStore.getState().navStack;
      expect(stack).toHaveLength(2);
      expect(stack[1].blockId).toBe('block-1');
    });

    it('should not pop below one item', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      useNavigationStore.getState().popOne();
      const stack = useNavigationStore.getState().navStack;
      expect(stack).toHaveLength(1); // Still has the page
    });
  });

  describe('selectBlock', () => {
    it('should set selected block', () => {
      useNavigationStore.getState().selectBlock('block-1');
      expect(useNavigationStore.getState().selectedBlockId).toBe('block-1');
    });

    it('should allow deselecting by passing null', () => {
      useNavigationStore.getState().selectBlock('block-1');
      useNavigationStore.getState().selectBlock(null);
      expect(useNavigationStore.getState().selectedBlockId).toBeNull();
    });
  });

  describe('clearSelection', () => {
    it('should clear selected block', () => {
      useNavigationStore.getState().selectBlock('block-1');
      useNavigationStore.getState().clearSelection();
      expect(useNavigationStore.getState().selectedBlockId).toBeNull();
    });
  });

  describe('getCurrentBlockId', () => {
    it('should return the last block ID in the stack', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      useNavigationStore.getState().pushBlock('block-1');
      useNavigationStore.getState().pushBlock('block-2');

      const currentId = useNavigationStore.getState().getCurrentBlockId();
      expect(currentId).toBe('block-2');
    });

    it('should return null when only a page is in the stack', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      const currentId = useNavigationStore.getState().getCurrentBlockId();
      expect(currentId).toBeNull();
    });

    it('should return null when stack is empty', () => {
      const currentId = useNavigationStore.getState().getCurrentBlockId();
      expect(currentId).toBeNull();
    });
  });

  describe('getCurrentPath', () => {
    it('should return the path of the last stack entry', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      useNavigationStore.getState().pushBlock('block-1');

      const path = useNavigationStore.getState().getCurrentPath();
      expect(path).toBe('/canvas/block-1');
    });

    it('should return / when stack is empty', () => {
      const path = useNavigationStore.getState().getCurrentPath();
      expect(path).toBe('/');
    });
  });

  describe('canGoUp', () => {
    it('should return false when stack has 0 or 1 items', () => {
      expect(useNavigationStore.getState().canGoUp()).toBe(false);
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      expect(useNavigationStore.getState().canGoUp()).toBe(false);
    });

    it('should return true when stack has more than 1 item', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      useNavigationStore.getState().pushBlock('block-1');
      expect(useNavigationStore.getState().canGoUp()).toBe(true);
    });
  });

  describe('getBreadcrumbSegments', () => {
    it('should include home as the first segment', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      const segments = useNavigationStore.getState().getBreadcrumbSegments();
      expect(segments[0].type).toBe('home');
      expect(segments[0].label).toBe('Home');
    });

    it('should include all stack entries as segments', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      useNavigationStore.getState().pushBlock('block-1');
      useNavigationStore.getState().pushBlock('block-2');
      const segments = useNavigationStore.getState().getBreadcrumbSegments();
      expect(segments).toHaveLength(4); // Home + page + 2 blocks
      expect(segments[1].label).toBe('Foundry');
      expect(segments[2].blockId).toBe('block-1');
      expect(segments[3].blockId).toBe('block-2');
    });

    it('should mark the last segment as current', () => {
      useNavigationStore.getState().pushPage('foundry', 'Foundry', '/foundry');
      useNavigationStore.getState().pushBlock('block-1');
      const segments = useNavigationStore.getState().getBreadcrumbSegments();
      expect(segments[segments.length - 1].isCurrent).toBe(true);
      expect(segments[0].isCurrent).toBe(false);
    });
  });
});
