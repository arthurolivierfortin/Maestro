// @ts-nocheck
/**
 * useSpatialNav — Spatial navigation on the 2D page grid.
 *
 * Reads the PageRegistry to compute direction hints and navigate
 * between adjacent pages via Ctrl+Arrow. Manages page ID, detail
 * screen drill-downs, and a brief transition indicator.
 *
 * Does NOT manage agentState or agent-following (that's 41-F).
 */

import { useState, useCallback, useEffect } from 'react';
import type { PageRegistry } from '../registry/PageRegistry.ts';
import type { PageDefinition, Direction, DirectionHint, Position } from '../registry/types.ts';

// ── Detail screen (drill-down within a page) ─────────────────

export interface DetailScreen {
  type: string;
  id: string;
}

// ── Direction deltas ─────────────────────────────────────────

const DELTAS: Record<Direction, Position> = {
  up:    { x: 0, y: -1 },
  down:  { x: 0, y: 1 },
  left:  { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// ── Hook return type ─────────────────────────────────────────

export interface UseSpatialNavReturn {
  currentPageId: string;
  currentPage: PageDefinition | undefined;
  previousPageId: string | null;
  detailScreen: DetailScreen | null;
  directionHints: DirectionHint[];
  transitionDir: Direction | null;
  transitionTarget: PageDefinition | null;

  navigate: (direction: Direction) => void;
  goHome: () => void;
  goTo: (pageId: string) => void;
  rotateRing: (clockwise: boolean) => void;
  quickSwitch: () => void;
  openDetail: (detail: DetailScreen) => void;
  closeDetail: () => void;
}

// ── Hook ─────────────────────────────────────────────────────

export function useSpatialNav(
  registry: PageRegistry,
  initialPageId: string = 'agent',
): UseSpatialNavReturn {
  const [currentPageId, setCurrentPageId] = useState(initialPageId);
  const [previousPageId, setPreviousPageId] = useState<string | null>(null);
  const [detailScreen, setDetailScreen] = useState<DetailScreen | null>(null);
  const [transitionDir, setTransitionDir] = useState<Direction | null>(null);
  const [transitionTarget, setTransitionTarget] = useState<PageDefinition | null>(null);

  // Computed
  const currentPage = registry.getById(currentPageId);
  const directionHints = currentPage
    ? registry.getDirectionHints(currentPage.position)
    : [];

  // Navigate in a direction (Ctrl+Arrow)
  const navigate = useCallback((direction: Direction) => {
    const page = registry.getById(currentPageId);
    if (!page) return;

    const targetPos: Position = {
      x: page.position.x + DELTAS[direction].x,
      y: page.position.y + DELTAS[direction].y,
    };
    const target = registry.getAt(targetPos);
    if (!target) return; // no page in that direction — no-op

    setPreviousPageId(currentPageId);
    setCurrentPageId(target.id);
    setDetailScreen(null);
    setTransitionDir(direction);
    setTransitionTarget(target);
  }, [registry, currentPageId]);

  // Go home (Esc from non-agent page)
  const goHome = useCallback(() => {
    if (currentPageId === 'agent' && !detailScreen) return;
    setPreviousPageId(currentPageId);
    setCurrentPageId('agent');
    setDetailScreen(null);
  }, [currentPageId, detailScreen]);

  // Direct navigation by page ID (slash commands, etc.)
  const goTo = useCallback((pageId: string) => {
    if (!registry.getById(pageId)) return; // unknown page — no-op
    if (currentPageId === pageId && !detailScreen) return; // already there
    setPreviousPageId(currentPageId);
    setCurrentPageId(pageId);
    setDetailScreen(null);
  }, [registry, currentPageId, detailScreen]);

  // Rotate through ring pages (Ctrl+Left/Right from edge pages)
  const rotateRing = useCallback((clockwise: boolean) => {
    const ring = registry.getRing();
    if (ring.length === 0) return;

    const idx = ring.findIndex(p => p.id === currentPageId);
    if (idx === -1) {
      // On center (agent) — jump to first ring page
      goTo(ring[0].id);
      return;
    }

    const nextIdx = clockwise
      ? (idx + 1) % ring.length
      : (idx - 1 + ring.length) % ring.length;
    const next = ring[nextIdx];

    setPreviousPageId(currentPageId);
    setCurrentPageId(next.id);
    setDetailScreen(null);
  }, [registry, currentPageId, goTo]);

  // Quick switch (Ctrl+Tab — toggle between current and previous)
  const quickSwitch = useCallback(() => {
    if (previousPageId && previousPageId !== currentPageId) {
      const target = previousPageId;
      setPreviousPageId(currentPageId);
      setCurrentPageId(target);
      setDetailScreen(null);
    }
  }, [previousPageId, currentPageId]);

  // Detail screen drill-down
  const openDetail = useCallback((detail: DetailScreen) => {
    setDetailScreen(detail);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailScreen(null);
  }, []);

  // Auto-clear transition after 150ms
  useEffect(() => {
    if (transitionDir) {
      const timer = setTimeout(() => {
        setTransitionDir(null);
        setTransitionTarget(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [transitionDir]);

  return {
    currentPageId,
    currentPage,
    previousPageId,
    detailScreen,
    directionHints,
    transitionDir,
    transitionTarget,
    navigate,
    goHome,
    goTo,
    rotateRing,
    quickSwitch,
    openDetail,
    closeDetail,
  };
}
