// @ts-nocheck
/**
 * useAnimationTick — Provides a tick counter for TUI animations.
 *
 * Returns a tick number that increments at the given interval (default 120ms).
 * Use with spinnerFrame(), breathingDot(), activityFrame() from theme/animations.
 *
 * Example:
 *   const tick = useAnimationTick(120);
 *   const spinner = spinnerFrame(tick);
 */

import { useState, useEffect } from 'react';

export function useAnimationTick(intervalMs: number = 120): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return tick;
}
