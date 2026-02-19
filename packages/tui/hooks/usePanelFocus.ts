import { useState, useCallback } from 'react';

interface UsePanelFocusReturn {
  focusedPanel: string | null;
  nextFocus: () => void;
  prevFocus: () => void;
  setFocus: (name: string) => void;
  setFocusByIndex: (index: number) => void;
  isFocused: (name: string) => boolean;
}

const usePanelFocus = (panelNames: string[] = []): UsePanelFocusReturn => {
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const focusedPanel: string | null = panelNames.length > 0
    ? panelNames[Math.min(focusedIndex, panelNames.length - 1)]
    : null;
  const nextFocus = useCallback((): void => {
    if (panelNames.length === 0) return;
    setFocusedIndex(i => (i + 1) % panelNames.length);
  }, [panelNames.length]);
  const prevFocus = useCallback((): void => {
    if (panelNames.length === 0) return;
    setFocusedIndex(i => (i - 1 + panelNames.length) % panelNames.length);
  }, [panelNames.length]);
  const setFocus = useCallback((name: string): void => {
    const idx = panelNames.indexOf(name);
    if (idx >= 0) setFocusedIndex(idx);
  }, [panelNames]);
  const setFocusByIndex = useCallback((index: number): void => {
    if (index >= 0 && index < panelNames.length) {
      setFocusedIndex(index);
    }
  }, [panelNames.length]);
  const isFocused = useCallback((name: string): boolean => {
    return name === focusedPanel;
  }, [focusedPanel]);
  return { focusedPanel, nextFocus, prevFocus, setFocus, setFocusByIndex, isFocused };
};

export { usePanelFocus };
export type { UsePanelFocusReturn };
