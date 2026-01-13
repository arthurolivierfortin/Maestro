/**
 * useBlockExplorerVisibility Hook
 *
 * Determines whether the BlockExplorer should be visible based on current route.
 * BlockExplorer should be visible on:
 * - Canvas pages (editing composite blocks)
 * - Block edit pages for composite blocks
 */

import { useLocation, useParams } from 'react-router-dom';
import { useBlockStore } from '../store';
import { useNavigationStore } from '../store/navigationStore';

export function useBlockExplorerVisibility() {
  const location = useLocation();
  const params = useParams();
  const { getBlock } = useBlockStore();
  const navStack = useNavigationStore((s) => s.navStack);
  const getLastEntry = useNavigationStore((s) => s.getLastEntry);

  // Canvas pages - always show explorer
  if (location.pathname.startsWith('/canvas')) {
    return { isVisible: true, contextBlockId: params.blockId || null };
  }

  // Atomic block edit pages - show explorer for navigation context
  if (location.pathname.includes('/foundry/') && location.pathname.endsWith('/edit')) {
    const lastEntry = getLastEntry();
    // Check if we have navigation context (not just direct URL access)
    if (navStack.length > 1 && lastEntry?.type === 'block') {
      return { isVisible: true, contextBlockId: lastEntry.blockId || null };
    }
    // Direct access to atomic block edit - hide explorer
    return { isVisible: false, contextBlockId: null };
  }

  // Block edit pages - show only for composite blocks
  if (location.pathname.includes('/foundry/') && params.blockId) {
    const block = getBlock(params.blockId);
    // Show explorer if block exists and is composite (not atomic)
    if (block && !block.isAtomic) {
      return { isVisible: true, contextBlockId: params.blockId };
    }
  }

  // All other pages - hide explorer
  return { isVisible: false, contextBlockId: null };
}
