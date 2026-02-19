/**
 * useSelectableList — Keyboard-driven list selection with scroll windowing.
 *
 * Extracts the universal pattern from CatalogScreen, FoundryScreen,
 * HomeScreen, SpacesScreen, ModelsScreen: selectedIndex state,
 * j/k navigation, scroll window calculation, index clamping on data change.
 *
 * Pure React hook (no Ink dependency). Works in TUI and Frontend.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseSelectableListOptions {
  /** Total number of items in the list */
  itemCount: number;
  /** Number of visible items (for scroll windowing). 0 = show all. */
  pageSize?: number;
  /** Wrap around at list boundaries. Default false. */
  wrap?: boolean;
  /** Initial selected index. Default 0. */
  initialIndex?: number;
}

export interface UseSelectableListReturn {
  /** Currently selected index (0-based) */
  selectedIndex: number;
  /** Move selection up by 1 */
  moveUp: () => void;
  /** Move selection down by 1 */
  moveDown: () => void;
  /** Move selection up by one page */
  pageUp: () => void;
  /** Move selection down by one page */
  pageDown: () => void;
  /** Jump to a specific index */
  jumpTo: (index: number) => void;
  /** Reset selection to 0 (call on filter/tab change) */
  reset: () => void;
  /** First visible index in the scroll window */
  scrollStart: number;
  /** Number of items in the visible window */
  visibleCount: number;
  /** Whether there are items above the visible window */
  canScrollUp: boolean;
  /** Whether there are items below the visible window */
  canScrollDown: boolean;
  /** Human-readable position: "3/12" */
  positionLabel: string;
}

export function useSelectableList({
  itemCount,
  pageSize = 0,
  wrap = false,
  initialIndex = 0,
}: UseSelectableListOptions): UseSelectableListReturn {
  const [selectedIndex, setSelectedIndex] = useState(
    Math.min(initialIndex, Math.max(0, itemCount - 1))
  );

  // Clamp selectedIndex when itemCount changes (items removed, filter applied)
  const prevCountRef = useRef(itemCount);
  useEffect(() => {
    if (itemCount === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= itemCount) {
      setSelectedIndex(Math.max(0, itemCount - 1));
    }
    prevCountRef.current = itemCount;
  }, [itemCount, selectedIndex]);

  const clamp = useCallback((idx: number): number => {
    if (itemCount === 0) return 0;
    return Math.max(0, Math.min(idx, itemCount - 1));
  }, [itemCount]);

  const moveUp = useCallback(() => {
    setSelectedIndex(i => {
      if (itemCount === 0) return 0;
      if (i <= 0) return wrap ? itemCount - 1 : 0;
      return i - 1;
    });
  }, [itemCount, wrap]);

  const moveDown = useCallback(() => {
    setSelectedIndex(i => {
      if (itemCount === 0) return 0;
      if (i >= itemCount - 1) return wrap ? 0 : itemCount - 1;
      return i + 1;
    });
  }, [itemCount, wrap]);

  const effectivePageSize = pageSize > 0 ? pageSize : Math.max(1, itemCount);

  const pageUp = useCallback(() => {
    setSelectedIndex(i => clamp(i - effectivePageSize));
  }, [clamp, effectivePageSize]);

  const pageDown = useCallback(() => {
    setSelectedIndex(i => clamp(i + effectivePageSize));
  }, [clamp, effectivePageSize]);

  const jumpTo = useCallback((index: number) => {
    setSelectedIndex(clamp(index));
  }, [clamp]);

  const reset = useCallback(() => {
    setSelectedIndex(0);
  }, []);

  // Scroll window: center selectedIndex in visible area
  const showAll = pageSize <= 0 || pageSize >= itemCount;
  let scrollStart = 0;
  let visibleCount = itemCount;

  if (!showAll) {
    visibleCount = pageSize;
    scrollStart = Math.max(0,
      Math.min(
        selectedIndex - Math.floor(visibleCount / 2),
        itemCount - visibleCount,
      )
    );
  }

  const canScrollUp = scrollStart > 0;
  const canScrollDown = scrollStart + visibleCount < itemCount;

  const positionLabel = itemCount > 0
    ? `${selectedIndex + 1}/${itemCount}`
    : '0/0';

  return {
    selectedIndex,
    moveUp,
    moveDown,
    pageUp,
    pageDown,
    jumpTo,
    reset,
    scrollStart,
    visibleCount,
    canScrollUp,
    canScrollDown,
    positionLabel,
  };
}
