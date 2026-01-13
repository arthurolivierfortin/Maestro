/**
 * useBlockExplorerVisibility Hook
 *
 * Determines whether the BlockExplorer should be visible based on current route.
 * BlockExplorer should be visible on:
 * - Canvas pages (editing composite blocks)
 * - Block edit pages for composite blocks
 * - When editing atomic blocks (show explorer alongside edit page)
 */

import { useLocation, useParams } from 'react-router-dom';
import { useBlockStore } from '../store';
import { useNavigationStore } from '../store/navigationStore';

export function useBlockExplorerVisibility() {
  const location = useLocation();
  const params = useParams();
  const { getBlock } = useBlockStore();
  const { isEditingAtomicBlock, currentPath } = useNavigationStore();

  // Canvas pages - always show explorer
  if (location.pathname.startsWith('/canvas')) {
    return { isVisible: true, contextBlockId: params.blockId || null };
  }

  // When editing atomic blocks - always show explorer
  if (isEditingAtomicBlock) {
    // Use current path context or root
    const contextBlockId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;
    return { isVisible: true, contextBlockId };
  }

  // Block edit pages - show only for composite blocks
  if (location.pathname.includes('/foundry/') && location.pathname.endsWith('/edit')) {
    const blockId = params.blockId;
    if (blockId) {
      const block = getBlock(blockId);
      // Show explorer if block exists and is composite (not atomic)
      if (block && !block.isAtomic) {
        return { isVisible: true, contextBlockId: blockId };
      }
    }
  }

  // All other pages - hide explorer
  return { isVisible: false, contextBlockId: null };
}
