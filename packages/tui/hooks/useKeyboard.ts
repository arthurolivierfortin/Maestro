/**
 * useActionKeyboard — Action-based keyboard hook for Ink TUI.
 *
 * NOTE: This file exports only TYPES and the resolver logic.
 * The actual hook implementation lives in maestro-cli/monitor/ink/hooks/
 * because it depends on Ink's useInput (which requires ink in node_modules).
 *
 * To use: import { useActionKeyboard } from '../hooks/useKeyboard.ts'
 *         (from within the ink/ directory)
 */

import { resolveBindings, matchInput, type ResolvedBindings, type InkKey } from '../keybindings/keybinding-resolver.ts';

// ── Types (importable from anywhere) ──────────────────────────────

export type ActionHandlers = Record<string, () => void>;
export type KeyboardContext = 'toplevel' | 'detail';

// ── Factory: creates the action keyboard logic without Ink dependency ──

export function createActionKeyboardHandler(
  handlers: ActionHandlers,
  context: KeyboardContext = 'toplevel',
) {
  const resolved = resolveBindings(context);

  return (input: string, key: InkKey): void => {
    const actions = matchInput(input, key, resolved);
    for (const action of actions) {
      if (handlers[action]) {
        handlers[action]();
        return;
      }
    }

    // Number keys: check for panel.1, panel.2, panel.3
    const num = parseInt(input, 10);
    if (num >= 1 && num <= 9) {
      const panelAction = `panel.${num}`;
      if (handlers[panelAction]) {
        handlers[panelAction]();
        return;
      }
    }
  };
}
