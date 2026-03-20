/**
 * FocusProvider — Priority-based focus layer management for the TUI.
 *
 * Solves the "scroll bug": all useInput hooks fire simultaneously,
 * so typing in TaskInputBar also triggers scroll handlers elsewhere.
 *
 * 4 layers with priority: modal(4) > widget(3) > input(2) > page(1).
 * When a higher-priority layer is claimed, lower layers become inactive.
 *
 * Usage:
 *   h(FocusProvider, null, h(App, props))
 *
 *   const { claim, release, isActive } = useFocusContext();
 *   claim('modal');        // blocks widget, input, page
 *   release('modal');      // reactivates next highest claimed layer
 *   isActive('page');      // false if any higher layer is claimed
 */

import { createElement as h, createContext, useContext, useState, useCallback, useRef } from 'react';

// ── Types ───────────────────────────────────────────────────────

export type FocusLayer = 'modal' | 'widget' | 'input' | 'page';

const LAYER_PRIORITY: Record<FocusLayer, number> = {
  modal: 4,
  widget: 3,
  input: 2,
  page: 1,
};

export interface FocusContextType {
  claim: (layer: FocusLayer) => void;
  release: (layer: FocusLayer) => void;
  isActive: (layer: FocusLayer) => boolean;
  activeLayer: FocusLayer | null;
}

// ── Context ─────────────────────────────────────────────────────

const FocusContext = createContext<FocusContextType | null>(null);

/**
 * Default context when no FocusProvider is present.
 * All layers are considered active — matches pre-focus behavior.
 * This allows components to work standalone (e.g., in tests)
 * without requiring a FocusProvider wrapper.
 */
const DEFAULT_CONTEXT: FocusContextType = {
  claim: () => {},
  release: () => {},
  isActive: () => true,
  activeLayer: null,
};

export const useFocusContext = (): FocusContextType => {
  const ctx = useContext(FocusContext);
  return ctx || DEFAULT_CONTEXT;
};

// ── Provider ────────────────────────────────────────────────────

interface FocusProviderProps {
  children: any;
}

export const FocusProvider = ({ children }: FocusProviderProps) => {
  // Set of currently claimed layers
  const [claimedLayers, setClaimedLayers] = useState<Set<FocusLayer>>(new Set());
  // Ref to keep current value accessible in callbacks without stale closures
  const claimedRef = useRef<Set<FocusLayer>>(claimedLayers);
  claimedRef.current = claimedLayers;

  const claim = useCallback((layer: FocusLayer) => {
    setClaimedLayers(prev => {
      if (prev.has(layer)) return prev;
      const next = new Set(prev);
      next.add(layer);
      return next;
    });
  }, []);

  const release = useCallback((layer: FocusLayer) => {
    setClaimedLayers(prev => {
      if (!prev.has(layer)) return prev;
      const next = new Set(prev);
      next.delete(layer);
      return next;
    });
  }, []);

  const getActiveLayer = useCallback((): FocusLayer | null => {
    const claimed = claimedRef.current;
    if (claimed.size === 0) return null;
    let highest: FocusLayer | null = null;
    let highestPriority = 0;
    for (const layer of claimed) {
      const p = LAYER_PRIORITY[layer];
      if (p > highestPriority) {
        highestPriority = p;
        highest = layer;
      }
    }
    return highest;
  }, []);

  const isActive = useCallback((layer: FocusLayer): boolean => {
    const claimed = claimedRef.current;
    // If this layer isn't claimed, it's not active
    if (!claimed.has(layer)) return false;
    // Active only if no higher-priority layer is claimed
    const myPriority = LAYER_PRIORITY[layer];
    for (const other of claimed) {
      if (LAYER_PRIORITY[other] > myPriority) return false;
    }
    return true;
  }, []);

  // Compute activeLayer from state (for consumers who need it reactively)
  let activeLayer: FocusLayer | null = null;
  {
    let highestPriority = 0;
    for (const layer of claimedLayers) {
      const p = LAYER_PRIORITY[layer];
      if (p > highestPriority) {
        highestPriority = p;
        activeLayer = layer;
      }
    }
  }

  const contextValue: FocusContextType = {
    claim,
    release,
    isActive,
    activeLayer,
  };

  return h(FocusContext.Provider, { value: contextValue }, children);
};

// Re-export the priority map for testing
export { LAYER_PRIORITY };
