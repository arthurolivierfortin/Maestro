/**
 * useBlockExplorerVisibility Hook
 *
 * Determines whether the BlockExplorer should be visible based on current route.
 * BlockExplorer should only be visible on:
 * - Canvas pages (editing composite blocks)
 * - Block edit pages for composite blocks
 */

import { useLocation, useParams } from 'react-router-dom';
import { useBlockStore } from '../store';

export function useBlockExplorerVisibility() {
  const location = useLocation();
  const params = useParams();
  const { getBlock } = useBlockStore();

  // Canvas pages - always show explorer
  if (location.pathname.startsWith('/canvas')) {
    return { isVisible: true, contextBlockId: params.blockId || null };
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
