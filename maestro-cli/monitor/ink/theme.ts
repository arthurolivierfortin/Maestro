/**
 * Ink Theme — Single source of truth for all TUI styling.
 *
 * Pure utility functions (statusColor, statusIcon, formatDuration, etc.) are imported
 * from shared/ and re-exported so components can still do:
 *   import { statusColor, formatDuration } from '../theme.ts';
 */

import { createElement as h, type ReactElement } from 'react';
import { Text } from 'ink';

// Re-export pure functions from shared (unchanged API)
export { statusColor, statusIcon, typeBadgeColorMap } from '../../../shared/utils/status.ts';
export { formatDuration, formatTime, truncate } from '../../../shared/utils/format.ts';
export { progressBar, progressColor, sparkline } from '../../../shared/utils/progress.ts';
export { resolvePath } from '../../../shared/utils/resolve.ts';

// ── Color palette ──────────────────────────────────────────────

export const theme = {
  bg: '#1e1e1e',
  fg: 'white',
  text: {
    primary: 'white',
    secondary: 'gray',
    muted: 'gray',
    dim: 'gray',
  },
  status: {
    success: 'green',
    running: 'cyan',
    pending: 'gray',
    warning: 'yellow',
    error: 'red',
    paused: 'yellow',
  },
  access: {
    readWrite: 'green',
    readOnly: 'yellow',
    none: 'red',
    ignored: 'gray',
    active: 'cyan',
  },
  panel: {
    border: 'gray',
    borderFocused: 'cyan',
    borderStyle: 'single' as const,
    title: 'gray',
    titleFocused: 'cyan',
    titleBold: true,
    bg: null as string | null,
    bgFocused: null as string | null,
    scrollIndicator: 'gray',
  },
  ui: {
    border: 'gray',
    borderActive: 'cyan',
    label: 'gray',
    highlight: 'cyan',
    separator: 'gray',
  },
  layout: {
    headerHeight: 9,
    statusBarHeight: 3,
    borderWidth: 1,
  },
  tree: {
    cursor: 'cyan',
    expandIcon: 'gray',
    selectedBold: true,
  },
  shortcut: {
    bracket: 'gray',
    key: 'cyan',
    label: 'gray',
    keyInactive: 'gray',
  },
};

// ── Icons (Unicode) ────────────────────────────────────────────

export const icons = {
  done: '\u2713',
  running: '\u25CF',
  pending: '\u25CB',
  failed: '\u2717',
  paused: '\u2016',
  branch: '\u251C\u2500',
  lastBranch: '\u2514\u2500',
  vertical: '\u2502',
  expanded: '\u25BC',
  collapsed: '\u25B6',
  arrow: '\u2192',
  arrowUp: '\u25B2',
  arrowDown: '\u25BC',
  dot: '\u2022',
  connected: '\u25CF',
  scrollUp: '\u25B2',
  scrollDown: '\u25BC',
  focus: '\u25C6',
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
