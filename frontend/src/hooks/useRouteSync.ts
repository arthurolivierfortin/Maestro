/**
 * Route Synchronization Hook
 *
 * Syncs URL with the navigation store.
 * - URL changes → update store (for direct navigation, back/forward)
 * - Store changes → update URL (for programmatic navigation)
 */

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useNavigationStore } from '../store/navigationStore';

/**
 * Page definitions for top-level routes
 */
const PAGE_CONFIG: Record<string, { label: string; path: string }> = {
  home: { label: 'Home', path: '/' },
  foundry: { label: 'Foundry', path: '/foundry' },
  workflows: { label: 'Workflows', path: '/workflows' },
  models: { label: 'Models', path: '/models' },
  history: { label: 'History', path: '/history' },
};

/**
 * Parse URL to determine page and block
 */
function parseUrl(pathname: string, params: Record<string, string | undefined>): {
  pageId: string;
  blockId?: string;
} {
  if (pathname === '/' || pathname === '') {
    return { pageId: 'home' };
  }

  // /foundry/:blockId/edit → atomic block edit (still starts from foundry)
  if (pathname.startsWith('/foundry')) {
    if (params.blockId && pathname.includes('/edit')) {
      return { pageId: 'foundry', blockId: params.blockId };
    }
    return { pageId: 'foundry' };
  }

  // /canvas/:blockId → non-atomic block edit (starts from foundry for now)
  if (pathname.startsWith('/canvas')) {
    if (params.blockId) {
      return { pageId: 'foundry', blockId: params.blockId };
    }
    // Plain /canvas without blockId - treat as foundry
    return { pageId: 'foundry' };
  }

  if (pathname.startsWith('/workflows')) {
    return { pageId: 'workflows' };
  }

  if (pathname.startsWith('/models')) {
    return { pageId: 'models' };
  }

  if (pathname.startsWith('/history')) {
    return { pageId: 'history' };
  }

  return { pageId: 'home' };
}

/**
 * Hook to sync URL ↔ navigation store
 */
export function useRouteSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const isSyncingRef = useRef(false);

  // Get store state and actions
  const navStack = useNavigationStore((s) => s.navStack);
  const initFromUrl = useNavigationStore((s) => s.initFromUrl);
  const getCurrentPath = useNavigationStore((s) => s.getCurrentPath);

  // URL → Store: When URL changes (direct navigation, back/forward)
  useEffect(() => {
    if (isSyncingRef.current) return;

    const { pageId, blockId } = parseUrl(location.pathname, params as Record<string, string | undefined>);
    const pageConfig = PAGE_CONFIG[pageId];

    if (!pageConfig) {
      console.warn(`[useRouteSync] Unknown page: ${pageId}`);
      return;
    }

    isSyncingRef.current = true;
    initFromUrl(pageId, pageConfig.label, pageConfig.path, blockId);
    isSyncingRef.current = false;
  }, [location.pathname, JSON.stringify(params)]);

  // Store → URL: When store changes (programmatic navigation)
  useEffect(() => {
    if (isSyncingRef.current) return;
    if (navStack.length === 0) return;

    const expectedPath = getCurrentPath();
    if (location.pathname !== expectedPath) {
      isSyncingRef.current = true;
      navigate(expectedPath);
      isSyncingRef.current = false;
    }
  }, [navStack]);
}
