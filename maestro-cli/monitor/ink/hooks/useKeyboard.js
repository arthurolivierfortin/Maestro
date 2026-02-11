/**
 * useKeyboard — Wraps Ink's useInput for consistent keyboard handling.
 *
 * Supports plain arrows, Ctrl+arrows, special keys, and letter keys.
 *
 * Usage:
 *   useKeyboard({
 *     up: () => focusPrev(),
 *     down: () => focusNext(),
 *     ctrlUp: () => scrollUp(),
 *     ctrlDown: () => scrollDown(),
 *     enter: () => select(),
 *     q: () => quit(),
 *   });
 */

import { useInput } from 'ink';

const useKeyboard = (handlers = {}) => {
  useInput((input, key) => {
    // Ctrl+Arrow keys (scroll)
    if (key.upArrow && key.ctrl && handlers.ctrlUp) { handlers.ctrlUp(); return; }
    if (key.downArrow && key.ctrl && handlers.ctrlDown) { handlers.ctrlDown(); return; }
    if (key.leftArrow && key.ctrl && handlers.ctrlLeft) { handlers.ctrlLeft(); return; }
    if (key.rightArrow && key.ctrl && handlers.ctrlRight) { handlers.ctrlRight(); return; }

    // Plain arrow keys (focus navigation)
    if (key.upArrow && handlers.up) { handlers.up(); return; }
    if (key.downArrow && handlers.down) { handlers.down(); return; }
    if (key.leftArrow && handlers.left) { handlers.left(); return; }
    if (key.rightArrow && handlers.right) { handlers.right(); return; }

    // Special keys
    if (key.return && handlers.enter) { handlers.enter(); return; }
    if (key.escape && handlers.escape) { handlers.escape(); return; }
    if (input === ' ' && handlers.space) { handlers.space(); return; }
    if (key.tab && key.shift && handlers.shiftTab) { handlers.shiftTab(); return; }
    if (key.tab && handlers.tab) handlers.tab();

    // Letter keys
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

    // Number keys (1-9)
    const num = parseInt(input, 10);
    if (num >= 1 && num <= 9 && handlers.number) handlers.number(num);
  });
};

export { useKeyboard };
