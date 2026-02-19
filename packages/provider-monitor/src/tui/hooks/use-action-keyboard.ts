import { useInput } from 'ink';
import { resolveAction, type InkKeyInput } from '../keybinding-resolver.js';
import type { Action } from '../keybindings.js';

type ActionHandlers = Partial<Record<Action, () => void>>;

/** Hook that maps keyboard input to action handlers */
export function useActionKeyboard(handlers: ActionHandlers) {
  useInput((input: string, key: InkKeyInput) => {
    const action = resolveAction(input, key);
    if (action && handlers[action]) {
      handlers[action]!();
    }
  });
}
