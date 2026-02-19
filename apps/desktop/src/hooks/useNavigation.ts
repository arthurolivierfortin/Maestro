/**
 * useNavigation Hook
 *
 * Convenience hook for navigation operations.
 * Wraps the navigation store with additional computed values.
 */

import { useNavigationStore } from '../store/navigationStore';
import { useBlockStore } from '../store/blockStore';
import type { Block } from '../types/block.types';

/**
 * Navigation hook with computed values
 */
export function useNavigation() {
  // Core navigation state
  const navStack = useNavigationStore((s) => s.navStack);
  const selectedBlockId = useNavigationStore((s) => s.selectedBlockId);
  const propertiesPanelMode = useNavigationStore((s) => s.propertiesPanelMode);

  // Navigation actions
  const pushPage = useNavigationStore((s) => s.pushPage);
  const pushBlock = useNavigationStore((s) => s.pushBlock);
  const popToIndex = useNavigationStore((s) => s.popToIndex);
  const popOne = useNavigationStore((s) => s.popOne);
  const clearStack = useNavigationStore((s) => s.clearStack);

  // Selection actions
  const selectBlock = useNavigationStore((s) => s.selectBlock);
  const clearSelection = useNavigationStore((s) => s.clearSelection);
  const setPropertiesPanelMode = useNavigationStore((s) => s.setPropertiesPanelMode);

  // Getters from store
  const getCurrentBlockId = useNavigationStore((s) => s.getCurrentBlockId);
  const getCurrentPath = useNavigationStore((s) => s.getCurrentPath);
  const getBreadcrumbSegments = useNavigationStore((s) => s.getBreadcrumbSegments);
  const canGoUp = useNavigationStore((s) => s.canGoUp);
  const getLastEntry = useNavigationStore((s) => s.getLastEntry);

  // Block store helpers
  const getBlock = useBlockStore((state) => state.getBlock);
  const getRootBlock = useBlockStore((state) => state.getRootBlock);

  /**
   * Get current block (the one we're viewing inside)
   */
  const getCurrentBlock = (): Block | null => {
    const blockId = getCurrentBlockId();
    if (!blockId) return getRootBlock();
    return getBlock(blockId) || null;
  };

  /**
   * Check if a block can be navigated into (is not atomic)
   */
  const canNavigateInto = (blockId: string): boolean => {
    const block = getBlock(blockId);
    return block ? !block.isAtomic : false;
  };

  /**
   * Navigate into a block - handles both atomic and non-atomic
   * This is the main entry point for block navigation
   */
  const navigateToBlock = (blockId: string) => {
    pushBlock(blockId);
  };

  /**
   * Navigate up one level
   */
  const navigateUp = () => {
    popOne();
  };

  /**
   * Navigate to root (first page in stack)
   */
  const navigateToRoot = () => {
    if (navStack.length > 0) {
      popToIndex(0);
    }
  };

  /**
   * Check if at root of current page (only page in stack, no blocks)
   */
  const isAtRoot = () => {
    return navStack.length === 1 && navStack[0].type === 'page';
  };

  return {
    // State
    navStack,
    selectedBlockId,
    propertiesPanelMode,

    // Navigation actions
    pushPage,
    pushBlock,
    popToIndex,
    popOne,
    clearStack,
    navigateToBlock,
    navigateUp,
    navigateToRoot,

    // Selection actions
    selectBlock,
    clearSelection,
    setPropertiesPanelMode,

    // Computed/Getters
    getCurrentBlockId,
    getCurrentBlock,
    getCurrentPath,
    getBreadcrumbSegments,
    canGoUp,
    getLastEntry,
    canNavigateInto,
    isAtRoot,
    getRootBlock,
  };
}
