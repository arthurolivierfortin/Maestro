import { useState, useCallback, useRef } from 'react';

const SCROLL_STEP = 3;
const MAX_OFFSET = 200;

interface UseScrollReturn {
  getOffset: (panel: string) => number;
  scrollUp: (panel: string, step?: number) => void;
  scrollDown: (panel: string, step?: number) => void;
  scrollTo: (panel: string, offset: number) => void;
  reset: (panel?: string) => void;
  setMaxScroll: (panel: string, max: number) => void;
}

const useScroll = (): UseScrollReturn => {
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const maxOffsetsRef = useRef<Record<string, number>>({});
  const setMaxScroll = useCallback((panel: string, max: number): void => {
    maxOffsetsRef.current[panel] = Math.max(0, max);
  }, []);
  const getOffset = useCallback((panel: string): number => {
    return offsets[panel] || 0;
  }, [offsets]);
  const scrollUp = useCallback((panel: string, step: number = SCROLL_STEP): void => {
    setOffsets(prev => ({
      ...prev,
      [panel]: Math.max(0, (prev[panel] || 0) - step),
    }));
  }, []);
  const scrollDown = useCallback((panel: string, step: number = SCROLL_STEP): void => {
    setOffsets(prev => {
      const maxScroll = maxOffsetsRef.current[panel] != null
        ? maxOffsetsRef.current[panel]
        : MAX_OFFSET;
      const newOffset = Math.min(maxScroll, (prev[panel] || 0) + step);
      if (newOffset === (prev[panel] || 0)) return prev;
      return { ...prev, [panel]: newOffset };
    });
  }, []);
  const scrollTo = useCallback((panel: string, offset: number): void => {
    setOffsets(prev => {
      const maxScroll = maxOffsetsRef.current[panel] != null
        ? maxOffsetsRef.current[panel]
        : MAX_OFFSET;
      const clamped = Math.max(0, Math.min(maxScroll, offset));
      if (clamped === (prev[panel] || 0)) return prev;
      return { ...prev, [panel]: clamped };
    });
  }, []);
  const reset = useCallback((panel?: string): void => {
    if (panel) {
      setOffsets(prev => {
        if ((prev[panel] || 0) === 0) return prev;
        return { ...prev, [panel]: 0 };
      });
      delete maxOffsetsRef.current[panel];
    } else {
      setOffsets({});
      maxOffsetsRef.current = {};
    }
  }, []);
  return { getOffset, scrollUp, scrollDown, scrollTo, reset, setMaxScroll };
};

export { useScroll };
export type { UseScrollReturn };
