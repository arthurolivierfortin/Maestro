/**
 * Navigation Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useNavigationStore } from './navigationStore';

describe('useNavigationStore', () => {
  beforeEach(() => {
    // Reset to initial state
    useNavigationStore.setState({
      currentPath: [],
      selectedBlockId: null,
    });
  });

  describe('navigateInto', () => {
    it('should add block to path', () => {
      useNavigationStore.getState().navigateInto('block-1');
      expect(useNavigationStore.getState().currentPath).toEqual(['block-1']);
    });

    it('should append to existing path', () => {
      useNavigationStore.getState().navigateInto('block-1');
      useNavigationStore.getState().navigateInto('block-2');
      expect(useNavigationStore.getState().currentPath).toEqual(['block-1', 'block-2']);
    });

    it('should clear selection when navigating', () => {
      useNavigationStore.getState().selectBlock('block-1');
      expect(useNavigationStore.getState().selectedBlockId).toBe('block-1');

      useNavigationStore.getState().navigateInto('block-2');
      expect(useNavigationStore.getState().selectedBlockId).toBeNull();
    });
  });

  describe('navigateUp', () => {
    it('should remove last item from path', () => {
      useNavigationStore.getState().navigateInto('block-1');
      useNavigationStore.getState().navigateInto('block-2');

      useNavigationStore.getState().navigateUp();
      expect(useNavigationStore.getState().currentPath).toEqual(['block-1']);
    });

    it('should do nothing when at root', () => {
      useNavigationStore.getState().navigateUp();
      expect(useNavigationStore.getState().currentPath).toEqual([]);
    });

    it('should clear selection', () => {
      useNavigationStore.getState().navigateInto('block-1');
      useNavigationStore.getState().selectBlock('block-2');

      useNavigationStore.getState().navigateUp();
      expect(useNavigationStore.getState().selectedBlockId).toBeNull();
    });
  });

  describe('navigateTo', () => {
    it('should set path to specific value', () => {
      useNavigationStore.getState().navigateTo(['block-1', 'block-2', 'block-3']);
      expect(useNavigationStore.getState().currentPath).toEqual(['block-1', 'block-2', 'block-3']);
    });

    it('should clear selection', () => {
      useNavigationStore.getState().selectBlock('block-1');
      useNavigationStore.getState().navigateTo(['block-2']);
      expect(useNavigationStore.getState().selectedBlockId).toBeNull();
    });
  });

  describe('navigateToRoot', () => {
    it('should clear path', () => {
      useNavigationStore.getState().navigateInto('block-1');
      useNavigationStore.getState().navigateInto('block-2');

      useNavigationStore.getState().navigateToRoot();
      expect(useNavigationStore.getState().currentPath).toEqual([]);
    });

    it('should clear selection', () => {
      useNavigationStore.getState().selectBlock('block-1');
      useNavigationStore.getState().navigateToRoot();
      expect(useNavigationStore.getState().selectedBlockId).toBeNull();
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
    it('should return last block in path', () => {
      useNavigationStore.getState().navigateInto('block-1');
      useNavigationStore.getState().navigateInto('block-2');

      const currentId = useNavigationStore.getState().getCurrentBlockId();
      expect(currentId).toBe('block-2');
    });

    it('should return null when at root', () => {
      const currentId = useNavigationStore.getState().getCurrentBlockId();
      expect(currentId).toBeNull();
    });
  });

  describe('isAtRoot', () => {
    it('should return true when path is empty', () => {
      expect(useNavigationStore.getState().isAtRoot()).toBe(true);
    });

    it('should return false when path has items', () => {
      useNavigationStore.getState().navigateInto('block-1');
      expect(useNavigationStore.getState().isAtRoot()).toBe(false);
    });
  });
});
