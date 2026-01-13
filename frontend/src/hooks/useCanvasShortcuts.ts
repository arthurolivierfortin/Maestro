/**
 * Canvas Shortcuts Hook
 *
 * Implements keyboard shortcuts for canvas operations
 */

import { useEffect } from 'react';
import { useBlockStore } from '../store/blockStore';
import { useNavigationStore } from '../store/navigationStore';

export interface UseCanvasShortcutsOptions {
  enabled?: boolean;
  parentId: string | null;
}

/**
 * Hook for canvas keyboard shortcuts
 */
export function useCanvasShortcuts({ enabled = true, parentId }: UseCanvasShortcutsOptions) {
  const { removeBlock, duplicateBlock, undo, redo, canUndo, canRedo } = useBlockStore();
  const { selectedBlockId, selectBlock } = useNavigationStore();

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts if typing in an input
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

      // Delete selected block
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedBlockId) {
        event.preventDefault();
        removeBlock(selectedBlockId);
        selectBlock(null);
        return;
      }

      // Duplicate selected block (Ctrl+D)
      if (isCtrlOrCmd && event.key === 'd' && selectedBlockId) {
        event.preventDefault();
        duplicateBlock(selectedBlockId);
        return;
      }

      // Undo (Ctrl+Z)
      if (isCtrlOrCmd && event.key === 'z' && !event.shiftKey && canUndo()) {
        event.preventDefault();
        undo();
        return;
      }

      // Redo (Ctrl+Shift+Z or Ctrl+Y)
      if (
        (isCtrlOrCmd && event.shiftKey && event.key === 'z' && canRedo()) ||
        (isCtrlOrCmd && event.key === 'y' && canRedo())
      ) {
        event.preventDefault();
        redo();
        return;
      }

      // Deselect (Escape)
      if (event.key === 'Escape' && selectedBlockId) {
        event.preventDefault();
        selectBlock(null);
        return;
      }

      // Select all (Ctrl+A) - not implemented yet, would need to select all nodes in current view
      if (isCtrlOrCmd && event.key === 'a') {
        event.preventDefault();
        // TODO: Implement select all
        return;
      }

      // Copy (Ctrl+C) - not implemented yet
      if (isCtrlOrCmd && event.key === 'c' && selectedBlockId) {
        event.preventDefault();
        // TODO: Implement copy to clipboard
        return;
      }

      // Cut (Ctrl+X) - not implemented yet
      if (isCtrlOrCmd && event.key === 'x' && selectedBlockId) {
        event.preventDefault();
        // TODO: Implement cut
        return;
      }

      // Paste (Ctrl+V) - not implemented yet
      if (isCtrlOrCmd && event.key === 'v') {
        event.preventDefault();
        // TODO: Implement paste
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    enabled,
    selectedBlockId,
    parentId,
    removeBlock,
    duplicateBlock,
    undo,
    redo,
    canUndo,
    canRedo,
    selectBlock,
  ]);
}
