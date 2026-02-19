/**
 * LLM-Provider TUI Configuration — App-specific tab/shortcut/brand definitions.
 *
 * Imports shared types from @maestro/tui and configures them for the LLM-Provider monitor.
 * This file is the single source of app-specific TUI data.
 */

import type { TabDef } from '@maestro/tui/components';
import type { ShortcutProps } from '@maestro/tui/components';

/** LLM-Provider tab definitions */
export const tabs: TabDef[] = [
  { key: '1', id: 'metrics', label: 'Metrics' },
  { key: '2', id: 'logs',    label: 'Logs' },
  { key: '3', id: 'queue',   label: 'Queue' },
  { key: '4', id: 'models',  label: 'Models' },
];

/** Tab name type derived from tab definitions */
export type TabName = 'metrics' | 'logs' | 'queue' | 'models';

/** LLM-Provider status bar shortcuts */
export const shortcuts: ShortcutProps[] = [
  { k: '1-4', label: 'tabs' },
  { k: 'Tab', label: 'next' },
  { k: '\u2191\u2193', label: 'scroll' },
  { k: 'r',   label: 'refresh' },
  { k: 'q',   label: 'quit' },
];

/** LLM-Provider brand */
export const brand = {
  name: 'LLM-Provider',
} as const;
