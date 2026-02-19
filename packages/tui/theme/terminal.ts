/**
 * Terminal Background Control — OSC escape sequences for background color.
 *
 * Works on modern terminals (iTerm2, Windows Terminal, kitty, alacritty, etc.).
 * No-ops gracefully on non-TTY outputs.
 */

function hexToOscRgb(hex: string): string {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `rgb:${r}${r}/${g}${g}/${b}${b}`;
}

/**
 * Set the terminal background to a hex color (e.g., '#1e1e1e').
 * Uses OSC 11 escape sequence.
 */
export function setTerminalBg(hex: string): void {
  if (!hex || !process.stdout.isTTY) return;
  const osc = `\x1b]11;${hexToOscRgb(hex)}\x07`;
  process.stdout.write(osc);
}

/**
 * Reset the terminal background to its default.
 * Uses OSC 111 escape sequence.
 */
export function resetTerminalBg(): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write('\x1b]111\x07');
}
