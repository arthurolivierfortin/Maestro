/**
 * usePanelFocus — Focus management for monitor panels.
 *
 * Tracks which panel is focused, provides Tab cycling and direct set.
 *
 * Usage:
 *   const { focusedPanel, nextFocus, prevFocus, setFocus, isFocused } = usePanelFocus(panelNames);
 *
 * @param {string[]} panelNames — Ordered list of panel names that can receive focus
 * @returns {object} Focus state and helpers
 */

import { useState, useCallback } from 'react';

const usePanelFocus = (panelNames = []) => {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const focusedPanel = panelNames.length > 0
    ? panelNames[Math.min(focusedIndex, panelNames.length - 1)]
    : null;

  const nextFocus = useCallback(() => {
    if (panelNames.length === 0) return;
    setFocusedIndex(i => (i + 1) % panelNames.length);
  }, [panelNames.length]);

  const prevFocus = useCallback(() => {
    if (panelNames.length === 0) return;
    setFocusedIndex(i => (i - 1 + panelNames.length) % panelNames.length);
  }, [panelNames.length]);

  const setFocus = useCallback((name) => {
    const idx = panelNames.indexOf(name);
    if (idx >= 0) setFocusedIndex(idx);
  }, [panelNames]);

  const isFocused = useCallback((name) => {
    return name === focusedPanel;
  }, [focusedPanel]);

  return { focusedPanel, nextFocus, prevFocus, setFocus, isFocused };
};

export { usePanelFocus };
