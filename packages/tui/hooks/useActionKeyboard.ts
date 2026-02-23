// @ts-nocheck
/**
 * useActionKeyboard — Action-based keyboard hook for Ink TUI.
 *
 * Wraps createActionKeyboardHandler with Ink's useInput.
 * Re-creates handler each call to capture latest handler references.
 *
 * Usage:
 *   useActionKeyboard({
 *     'cursor.up': () => moveUp(),
 *     'quit': () => exit(),
 *   }, 'toplevel');
 */

import { useInput } from 'ink';
import {
  createActionKeyboardHandler,
  type ActionHandlers,
  type KeyboardContext,
} from './useKeyboard.ts';

export { type ActionHandlers, type KeyboardContext };

export const useActionKeyboard = (
  handlers: ActionHandlers,
  context: KeyboardContext = 'toplevel',
): void => {
  useInput((input: string, key) => {
    const handler = createActionKeyboardHandler(handlers, context);
    handler(input, key);
  });
};
