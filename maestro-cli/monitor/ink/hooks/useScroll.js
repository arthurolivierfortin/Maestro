/**
 * useScroll — Scroll offset management for panels.
 *
 * Tracks per-panel scroll offsets with content-aware max limits.
 * Prevents scrolling past content boundaries.
 *
 * Usage:
 *   const { getOffset, scrollUp, scrollDown, scrollTo, reset, setMaxScroll } = useScroll();
 *   setMaxScroll('tree', flatNodes.length);   // set content height
 *   // In render: <Panel scrollOffset={getOffset('tree')} />
 *   // On key up: scrollUp('tree')
 */

import { useState, useCallback, useRef } from 'react';

const SCROLL_STEP = 3;   // lines per scroll event
const MAX_OFFSET = 50;   // safety cap (fallback when no max set)

const useScroll = () => {
  const [offsets, setOffsets] = useState({});
  // Use ref for max offsets to keep scrollDown callback stable
  const maxOffsetsRef = useRef({});

  /**
   * Set the maximum scroll offset for a panel.
   * Typically: max(0, contentLines - visibleLines).
   */
  const setMaxScroll = useCallback((panel, max) => {
    maxOffsetsRef.current[panel] = Math.max(0, max);
  }, []);

  const getOffset = useCallback((panel) => {
    return offsets[panel] || 0;
  }, [offsets]);

  const scrollUp = useCallback((panel, step = SCROLL_STEP) => {
    setOffsets(prev => ({
      ...prev,
      [panel]: Math.max(0, (prev[panel] || 0) - step),
    }));
  }, []);

  const scrollDown = useCallback((panel, step = SCROLL_STEP) => {
    setOffsets(prev => {
      const maxScroll = maxOffsetsRef.current[panel] != null
        ? maxOffsetsRef.current[panel]
        : MAX_OFFSET;
      const newOffset = Math.min(maxScroll, (prev[panel] || 0) + step);
      if (newOffset === (prev[panel] || 0)) return prev; // no-op
      return { ...prev, [panel]: newOffset };
    });
  }, []);

  const scrollTo = useCallback((panel, offset) => {
    setOffsets(prev => {
      const maxScroll = maxOffsetsRef.current[panel] != null
        ? maxOffsetsRef.current[panel]
        : MAX_OFFSET;
      const clamped = Math.max(0, Math.min(maxScroll, offset));
      if (clamped === (prev[panel] || 0)) return prev; // no-op
      return { ...prev, [panel]: clamped };
    });
  }, []);

  const reset = useCallback((panel) => {
    if (panel) {
      setOffsets(prev => {
        if ((prev[panel] || 0) === 0) return prev; // no-op
        return { ...prev, [panel]: 0 };
      });
    } else {
      setOffsets({});
    }
  }, []);

  return { getOffset, scrollUp, scrollDown, scrollTo, reset, setMaxScroll };
};

export { useScroll };
