/**
 * Ink Theme — TUI styling adapter over shared/theme.
 *
 * Imports colors, icons, and layout from shared/theme and adds
 * Ink-specific React helpers (T, Badge, etc.).
 *
 * Components import from this file:
 *   import { theme, icons, T, statusColor } from '../theme.ts';
 */

import { createElement as h, type ReactElement } from 'react';
import { Text } from 'ink';

// Re-export pure functions from shared utils (unchanged API)
export { statusColor, statusIcon, typeBadgeColorMap } from '@maestro/tui/utils';
export { formatDuration, formatTime, truncate } from '@maestro/tui/utils';
export { progressBar, progressColor, sparkline } from '@maestro/tui/utils';
export { resolvePath } from '@maestro/tui/utils';

// Import from shared theme
import { palette, semantic } from '@maestro/tui/theme';
import { icons as sharedIcons, layout as sharedLayout } from '@maestro/tui/theme';

// Re-export icons from shared theme
export const icons = sharedIcons;

// ── Ink theme object — composed from shared semantic colors + Ink-specific extras ──

export const theme = {
  bg: palette.bg,
  fg: 'white',
  text: semantic.text,
  status: semantic.status,
  access: semantic.access,
  panel: {
    ...semantic.panel,
    borderStyle: 'single' as const,
    titleBold: true,
    bg: null as string | null,
    bgFocused: null as string | null,
    scrollIndicator: 'gray',
  },
  ui: semantic.ui,
  layout: sharedLayout,
  tree: {
    ...semantic.tree,
    selectedBold: true,
  },
  shortcut: semantic.shortcut,
};

// ── Text helper: T(color, text, opts) ──────────────────────────

export const T = (color: string, text: string, opts: Record<string, unknown> = {}): ReactElement =>
  h(Text, { color, ...opts }, text);

// ── Shortcut helpers (return React elements) ───────────────────

export const primary = (text: string): ReactElement => T(theme.text.primary, text);
export const secondary = (text: string): ReactElement => T(theme.text.secondary, text);
export const muted = (text: string): ReactElement => T(theme.text.muted, text);
export const dim = (text: string): ReactElement => h(Text, { dimColor: true }, text);
export const success = (text: string): ReactElement => T(theme.status.success, text);
export const running = (text: string): ReactElement => T(theme.status.running, text);
export const error = (text: string): ReactElement => T(theme.status.error, text);
export const warning = (text: string): ReactElement => T(theme.status.warning, text);
export const label = (text: string): ReactElement => h(Text, { color: theme.ui.highlight, bold: true }, text);
export const bold = (text: string): ReactElement => h(Text, { bold: true }, text);
export const highlight = (text: string): ReactElement => T(theme.ui.highlight, text);

// ── Badge: [status] with colored label ─────────────────────────

import { statusColor } from '@maestro/tui/utils';

interface BadgeProps {
  status: string;
}

export const Badge = ({ status }: BadgeProps): ReactElement => {
  const col = statusColor(status);
  const labelMap: Record<string, string> = {
    done: 'done', completed: 'done', success: 'done',
    running: 'running', active: 'active',
    pending: '...', waiting: '...',
    failed: 'FAIL', error: 'ERR', paused: 'paused',
  };
  const text = labelMap[(status || '').toLowerCase()] || status;
  return h(Text, {},
    h(Text, { color: theme.shortcut.bracket }, '['),
    h(Text, { color: col }, text),
    h(Text, { color: theme.shortcut.bracket }, ']')
  );
};

// ── TypeBadge: [type] with colored label ─────────────────────

import { typeBadgeColorMap } from '@maestro/tui/utils';

interface TypeBadgeProps {
  type: string;
}

// ── Page navigation ─────────────────────────────────────────────

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

export const TypeBadge = ({ type }: TypeBadgeProps): ReactElement => {
  const t = (type || 'unknown').toLowerCase();
  const color = typeBadgeColorMap[t] || 'gray';
  return h(Text, null,
    h(Text, { color }, '['),
    h(Text, { color }, t),
    h(Text, { color }, ']'),
  );
};

// ── "Vivant" Animation Helpers ──────────────────────────────────

/** Spinner frames for loading/connecting states */
export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/** Breathing dot frames — pulses between bright and dim */
export const BREATHING_DOTS = ['●', '●', '●', '◉', '○', '◉', '●', '●'];

/** Activity bar frames */
export const ACTIVITY_FRAMES = ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '█', '▉', '▊', '▋', '▌', '▍', '▎', '▏'];

/** Get spinner frame based on tick count */
export const spinnerFrame = (tick: number): string =>
  SPINNER_FRAMES[tick % SPINNER_FRAMES.length];

/** Get breathing dot frame based on tick count */
export const breathingDot = (tick: number): string =>
  BREATHING_DOTS[tick % BREATHING_DOTS.length];

/** Get activity bar frame */
export const activityFrame = (tick: number): string =>
  ACTIVITY_FRAMES[tick % ACTIVITY_FRAMES.length];
