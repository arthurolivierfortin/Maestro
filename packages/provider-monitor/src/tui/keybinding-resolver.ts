import { keybindings, type Action } from './keybindings.js';

export interface InkKeyInput {
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  return?: boolean;
  escape?: boolean;
  tab?: boolean;
  backspace?: boolean;
  delete?: boolean;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
}

/** Resolves an Ink key input event into an action */
export function resolveAction(input: string, key: InkKeyInput): Action | null {
  if (key.tab) return 'tab.next';
  if (key.upArrow) return 'scroll.up';
  if (key.downArrow) return 'scroll.down';

  const binding = keybindings.find(b => b.key === input);
  return binding?.action ?? null;
}
