/**
 * @maestro/tui Theme — Barrel export.
 */

export { palette, semantic } from './colors.ts';
export { brand } from './brand.ts';
export { icons, border, layout } from './tokens.ts';
export { setTerminalBg, resetTerminalBg } from './terminal.ts';
export { createTheme, type MaestroTheme, type ThemeOverrides } from './create-theme.ts';

// Ink-specific theme + text helpers
export {
  inkTheme, T, primary, secondary, muted, dim,
  success, running, error, warning, label, bold, highlight,
  Badge, TypeBadge,
} from './ink.ts';

// Animation helpers
export {
  SPINNER_FRAMES, BREATHING_DOTS, ACTIVITY_FRAMES,
  spinnerFrame, breathingDot, activityFrame,
} from './animations.ts';
