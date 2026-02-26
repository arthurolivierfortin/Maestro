import { useInput } from 'ink';
import {
  createActionKeyboardHandler,
  type ActionHandlers,
  type KeyboardContext,
} from '@maestro/tui/hooks';

// Re-export types + shared useActionKeyboard
export type { ActionHandlers, KeyboardContext };
export { useActionKeyboard } from '@maestro/tui/hooks';

// ── Legacy interface (kept for components not yet migrated) ───────

interface KeyboardHandlers {
  up?: () => void;
  down?: () => void;
  left?: () => void;
  right?: () => void;
  ctrlUp?: () => void;
  ctrlDown?: () => void;
  ctrlLeft?: () => void;
  ctrlRight?: () => void;
  enter?: () => void;
  escape?: () => void;
  space?: () => void;
  tab?: () => void;
  shiftTab?: () => void;
  q?: () => void;
  r?: () => void;
  h?: () => void;
  '?'?: () => void;
  t?: () => void;
  f?: () => void;
  w?: () => void;
  v?: () => void;
  l?: () => void;
  z?: () => void;
  k?: () => void;
  j?: () => void;
  s?: () => void;
  c?: () => void;
  m?: () => void;
  n?: () => void;
  a?: () => void;
  number?: (n: number) => void;
}

const useKeyboard = (handlers: KeyboardHandlers = {}, options?: { isActive?: boolean }): void => {
  useInput((input: string, key) => {
    if (key.upArrow && key.ctrl && handlers.ctrlUp) { handlers.ctrlUp(); return; }
    if (key.downArrow && key.ctrl && handlers.ctrlDown) { handlers.ctrlDown(); return; }
    if (key.leftArrow && key.ctrl && handlers.ctrlLeft) { handlers.ctrlLeft(); return; }
    if (key.rightArrow && key.ctrl && handlers.ctrlRight) { handlers.ctrlRight(); return; }
    if (key.upArrow && handlers.up) { handlers.up(); return; }
    if (key.downArrow && handlers.down) { handlers.down(); return; }
    if (key.leftArrow && handlers.left) { handlers.left(); return; }
    if (key.rightArrow && handlers.right) { handlers.right(); return; }
    if (key.return && handlers.enter) { handlers.enter(); return; }
    if (key.escape && handlers.escape) { handlers.escape(); return; }
    if (input === ' ' && handlers.space) { handlers.space(); return; }
    if (key.tab && key.shift && handlers.shiftTab) { handlers.shiftTab(); return; }
    if (key.tab && handlers.tab) handlers.tab();
    if (input === 'q' && handlers.q) handlers.q();
    if (input === 'r' && handlers.r) handlers.r();
    if (input === 'h' && handlers.h) handlers.h();
    if (input === '?' && handlers['?']) handlers['?']();
    if (input === 't' && handlers.t) handlers.t();
    if (input === 'f' && handlers.f) handlers.f();
    if (input === 'w' && handlers.w) handlers.w();
    if (input === 'v' && handlers.v) handlers.v();
    if (input === 'l' && handlers.l) handlers.l();
    if (input === 'z' && handlers.z) handlers.z();
    if (input === 'k' && handlers.k) handlers.k();
    if (input === 'j' && handlers.j) handlers.j();
    if (input === 's' && handlers.s) handlers.s();
    if (input === 'c' && handlers.c) handlers.c();
    if (input === 'm' && handlers.m) handlers.m();
    if (input === 'n' && handlers.n) handlers.n();
    if (input === 'a' && handlers.a) handlers.a();
    const num = parseInt(input, 10);
    if (num >= 1 && num <= 9 && handlers.number) handlers.number(num);
  }, { isActive: options?.isActive !== false });
};

export { useKeyboard };
export type { KeyboardHandlers };
