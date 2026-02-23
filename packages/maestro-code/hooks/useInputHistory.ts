/**
 * useInputHistory — Stores input history and provides Up/Down navigation.
 *
 * Stores the last N inputs (default 50). The user presses Up/Down
 * to cycle through history. When navigating, the current draft is preserved.
 *
 * Usage:
 *   const history = useInputHistory();
 *   // On submit: history.push(value)
 *   // On up arrow: history.prev() → returns string or null
 *   // On down arrow: history.next() → returns string or null
 *   // On text change: history.resetIndex() to cancel navigation
 */

import { useState, useRef, useCallback } from 'react';

const MAX_HISTORY = 50;

interface UseInputHistoryReturn {
  push: (input: string) => void;
  prev: () => string | null;
  next: () => string | null;
  resetIndex: () => void;
}

export function useInputHistory(): UseInputHistoryReturn {
  const historyRef = useRef<string[]>([]);
  const indexRef = useRef<number>(-1); // -1 = not navigating

  const push = useCallback((input: string) => {
    const hist = historyRef.current;
    // Don't add duplicates of the last entry
    if (hist.length === 0 || hist[hist.length - 1] !== input) {
      hist.push(input);
      if (hist.length > MAX_HISTORY) {
        hist.shift();
      }
    }
    indexRef.current = -1;
  }, []);

  const prev = useCallback((): string | null => {
    const hist = historyRef.current;
    if (hist.length === 0) return null;

    if (indexRef.current === -1) {
      // Start navigating from the end
      indexRef.current = hist.length - 1;
    } else if (indexRef.current > 0) {
      indexRef.current--;
    }
    return hist[indexRef.current] ?? null;
  }, []);

  const next = useCallback((): string | null => {
    const hist = historyRef.current;
    if (indexRef.current === -1) return null;

    if (indexRef.current < hist.length - 1) {
      indexRef.current++;
      return hist[indexRef.current];
    } else {
      // Past the end — back to blank
      indexRef.current = -1;
      return '';
    }
  }, []);

  const resetIndex = useCallback(() => {
    indexRef.current = -1;
  }, []);

  return { push, prev, next, resetIndex };
}
