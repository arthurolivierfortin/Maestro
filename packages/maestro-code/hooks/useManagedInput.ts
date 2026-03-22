/**
 * useManagedInput — Focus-gated wrapper around Ink's useInput.
 *
 * The handler only fires when the specified FocusLayer is active
 * (i.e., no higher-priority layer is claimed).
 *
 * Usage:
 *   useManagedInput('page', (input, key) => {
 *     if (input === 'q') exit();
 *   });
 *
 * When a 'modal' layer is claimed, this handler won't fire for 'page' layer.
 */

import { useInput, type Key } from 'ink';
import { useRef } from 'react';
import { useFocusContext, type FocusLayer } from './useFocusProvider.ts';

export type InputHandler = (input: string, key: Key) => void;

export const useManagedInput = (
  layer: FocusLayer,
  handler: InputHandler,
  options?: { isActive?: boolean },
): void => {
  const { isActive } = useFocusContext();
  // Keep handler in a ref to avoid stale closures
  const handlerRef = useRef<InputHandler>(handler);
  handlerRef.current = handler;

  useInput((input: string, key: Key) => {
    if (isActive(layer)) {
      handlerRef.current(input, key);
    }
  }, { isActive: options?.isActive !== false });
};

export type { FocusLayer, Key };
