/**
 * Ink Theme — Monitor theme adapter.
 *
 * Re-exports shared Ink helpers from @maestro/tui.
 * Keeps monitor-specific page navigation locally.
 *
 * Components import from this file:
 *   import { theme, icons, T, statusColor } from '../theme.ts';
 */

// Re-export pure functions from shared utils
export { statusColor, statusIcon, typeBadgeColorMap } from '@maestro/tui/utils';
export { formatDuration, formatTime, truncate } from '@maestro/tui/utils';
export { progressBar, progressColor, sparkline } from '@maestro/tui/utils';
export { resolvePath } from '@maestro/tui/utils';

// Re-export icons from shared theme
export { icons } from '@maestro/tui/theme';

// Re-export Ink theme object + text helpers
export {
  inkTheme as theme,
  T, primary, secondary, muted, dim,
  success, running, error, warning, label, bold, highlight,
  Badge, TypeBadge,
} from '@maestro/tui/theme/ink';

// Re-export animation helpers
export {
  SPINNER_FRAMES, BREATHING_DOTS, ACTIVITY_FRAMES,
  spinnerFrame, breathingDot, activityFrame,
} from '@maestro/tui/theme/animations';

// ── Monitor-specific: Page navigation ─────────────────────────────

export type PageName = 'home' | 'spaces' | 'foundry' | 'catalog' | 'models';

export const PAGE_ORDER: PageName[] = ['home', 'spaces', 'foundry', 'catalog', 'models'];

/** Get previous page (wrap-around). */
export const prevPage = (current: PageName): PageName => {
  const idx = PAGE_ORDER.indexOf(current);
  return PAGE_ORDER[(idx - 1 + PAGE_ORDER.length) % PAGE_ORDER.length];
};

/** Get next page (wrap-around). */
export const nextPage = (current: PageName): PageName => {
  const idx = PAGE_ORDER.indexOf(current);
  return PAGE_ORDER[(idx + 1) % PAGE_ORDER.length];
};
