/**
 * useNavigation Hook
 *
 * Convenience hook for navigation operations.
 */

import { useNavigationStore } from '../store/navigationStore';
import { useBlockStore } from '../store/blockStore';
import type { Block } from '../types/block.types';

/**
 * Navigation hook with computed values
 */
export function useNavigation() {
  const navigation = useNavigationStore();
  const getBlock = useBlockStore((state) => state.getBlock);
  const getRootBlock = useBlockStore((state) => state.getRootBlock);

  /**
   * Get current block (the one we're viewing inside)
   */
  const getCurrentBlock = (): Block | null => {
    const currentId = navigation.getCurrentBlockId();
    if (!currentId) return getRootBlock();
    return getBlock(currentId) || null;
  };

  /**
   * Get breadcrumb items with block info
   */
  const getBreadcrumbs = (): Array<{ id: string; block: Block | undefined }> => {
    const root = getRootBlock();
    const items: Array<{ id: string; block: Block | undefined }> = [];

    if (root) {
      items.push({ id: root.id, block: root });
    }

    navigation.currentPath.forEach((id) => {
      if (id !== root?.id) {
        items.push({ id, block: getBlock(id) });
      }
    });

    return items;
  };

  /**
   * Check if a block can be navigated into
   */
  const canNavigateInto = (blockId: string): boolean => {
    const block = getBlock(blockId);
    return block ? !block.isAtomic : false;
  };

  return {
    ...navigation,
    getCurrentBlock,
    getBreadcrumbs,
    canNavigateInto,
    getRootBlock,
  };
}
