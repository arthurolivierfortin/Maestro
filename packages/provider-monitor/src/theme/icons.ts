/** Unicode icons used throughout the TUI */
export const icons = {
  running: '\u25CF',     // ●
  pending: '\u25CB',     // ○
  done: '\u2713',        // ✓
  failed: '\u2717',      // ✗
  model: '\u2B22',       // ⬢
  queue: '\u2630',       // ☰
  switchIcon: '\u21C4',  // ⇄
  arrow: '\u2192',       // →
  arrowRight: '\u2192',  // →
  arrowUp: '\u25B2',     // ▲
  arrowDown: '\u25BC',   // ▼
  bullet: '\u2022',      // •
  dot: '\u2022',         // •
  connected: '\u25CF',   // ●
  focus: '\u25C6',       // ◆
  scrollUp: '\u25B2',    // ▲
  scrollDown: '\u25BC',  // ▼
  spinner: ['\u280B', '\u2819', '\u2838', '\u28B0', '\u28E0', '\u28C4', '\u2846', '\u2807'],
  bar: ['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'],
  warning: '\u26A0',     // ⚠
  info: '\u2139',        // ℹ
} as const;
