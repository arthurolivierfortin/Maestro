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
export { statusColor, statusIcon, typeBadgeColorMap } from '../../../shared/utils/status.ts';
export { formatDuration, formatTime, truncate } from '../../../shared/utils/format.ts';
export { progressBar, progressColor, sparkline } from '../../../shared/utils/progress.ts';
export { resolvePath } from '../../../shared/utils/resolve.ts';

// Import from shared theme
import { palette, semantic } from '../../../shared/theme/colors.ts';
import { icons as sharedIcons, layout as sharedLayout } from '../../../shared/theme/tokens.ts';

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

import { statusColor } from '../../../shared/utils/status.ts';

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

import { typeBadgeColorMap } from '../../../shared/utils/status.ts';

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
