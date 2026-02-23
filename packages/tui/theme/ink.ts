// @ts-nocheck
/**
 * Ink Theme — Composed theme object + React text helpers for Ink TUI.
 *
 * Provides the `inkTheme` object (semantic colors + Ink-specific extras)
 * and text helper functions (T, primary, muted, etc.) that return React elements.
 *
 * Usage:
 *   import { inkTheme as theme, T, primary, muted, Badge } from '@maestro/tui/theme/ink';
 */

import { createElement as h, type ReactElement } from 'react';
import { Text } from 'ink';
import { palette, semantic } from './colors.ts';
import { layout } from './tokens.ts';
import { statusColor, typeBadgeColorMap } from '../utils/status.ts';

// ── Composed Ink theme object ────────────────────────────────────

export const inkTheme = {
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
  layout,
  tree: {
    ...semantic.tree,
    selectedBold: true,
  },
  shortcut: semantic.shortcut,
};

// ── Text helper: T(color, text, opts) ────────────────────────────

export const T = (color: string, text: string, opts: Record<string, unknown> = {}): ReactElement =>
  h(Text, { color, ...opts }, text);

// ── Shorthand text helpers (return React elements) ───────────────

export const primary = (text: string): ReactElement => T(inkTheme.text.primary, text);
export const secondary = (text: string): ReactElement => T(inkTheme.text.secondary, text);
export const muted = (text: string): ReactElement => T(inkTheme.text.muted, text);
export const dim = (text: string): ReactElement => h(Text, { dimColor: true }, text);
export const success = (text: string): ReactElement => T(inkTheme.status.success, text);
export const running = (text: string): ReactElement => T(inkTheme.status.running, text);
export const error = (text: string): ReactElement => T(inkTheme.status.error, text);
export const warning = (text: string): ReactElement => T(inkTheme.status.warning, text);
export const label = (text: string): ReactElement => h(Text, { color: inkTheme.ui.highlight, bold: true }, text);
export const bold = (text: string): ReactElement => h(Text, { bold: true }, text);
export const highlight = (text: string): ReactElement => T(inkTheme.ui.highlight, text);

// ── Badge: [status] with colored label ───────────────────────────

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
    h(Text, { color: inkTheme.shortcut.bracket }, '['),
    h(Text, { color: col }, text),
    h(Text, { color: inkTheme.shortcut.bracket }, ']')
  );
};

// ── TypeBadge: [type] with colored label ─────────────────────────

interface TypeBadgeProps {
  type: string;
}

export const TypeBadge = ({ type }: TypeBadgeProps): ReactElement => {
  const t = (type || 'unknown').toLowerCase();
  const color = typeBadgeColorMap[t] || 'gray';
  return h(Text, null,
    h(Text, { color }, '['),
    h(Text, { color }, t),
    h(Text, { color }, ']'),
  );
};
