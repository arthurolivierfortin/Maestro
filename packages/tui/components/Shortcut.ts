/**
 * Shortcut — [key]label micro-component.
 *
 * Renders a keyboard shortcut hint: [q]uit, [Tab]next, [↑↓]scroll
 * Uses semantic.shortcut colors from shared theme.
 *
 * Used by: AppStatusBar, StatusBar, and any component showing keyboard hints.
 */

import { createElement as h } from 'react';
import { Text } from 'ink';
import { semantic } from '../theme/colors.ts';

export interface ShortcutProps {
  /** Key character(s) displayed inside brackets: "q", "Tab", "1-4", "↑↓" */
  k: string;
  /** Label displayed after the key: "quit", "next", "scroll" */
  label: string;
  /** When false, the entire shortcut is dimmed. Default true. */
  active?: boolean;
}

const Shortcut = ({ k, label, active = true }: ShortcutProps) => {
  if (!active) {
    return h(Text, { dimColor: true }, `[${k}]${label}`);
  }
  return h(Text, null,
    h(Text, { color: semantic.shortcut.bracket, dimColor: true }, '['),
    h(Text, { color: semantic.shortcut.key }, k),
    h(Text, { color: semantic.shortcut.bracket, dimColor: true }, ']'),
    h(Text, { color: semantic.shortcut.label }, label),
  );
};

export { Shortcut };
