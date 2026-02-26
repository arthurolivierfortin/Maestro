// @ts-nocheck
/**
 * NavBar — Monitor-specific navigation bar.
 *
 * Wraps the shared NavBar component from @maestro/tui with
 * the monitor's 5-page navigation (Home, Spaces, Foundry, Catalog, Models).
 */

import { createElement as h } from 'react';
import { Text } from 'ink';
import { NavBar as SharedNavBar } from '@maestro/tui/components';
import { theme, icons } from '../theme.ts';

const MONITOR_PAGES = [
  { key: 'home',    hotkey: 'H', label: 'ome' },
  { key: 'spaces',  hotkey: 'S', label: 'paces' },
  { key: 'foundry', hotkey: 'F', label: 'oundry' },
  { key: 'catalog', hotkey: 'C', label: 'atalog' },
  { key: 'models',  hotkey: 'M', label: 'odels' },
];

const NavBar = ({ currentPage = 'home', sessionCount = 0, runningCount = 0 }) => {
  // Session count badge
  const badge = sessionCount > 0
    ? h(Text, { color: theme.text.muted },
        `  ${icons.dot} `,
        h(Text, { color: theme.text.primary }, String(sessionCount)),
        h(Text, { color: theme.text.muted }, ' sessions'),
        runningCount > 0
          ? h(Text, { color: theme.status.running }, ` (${runningCount} running)`)
          : null,
      )
    : null;

  return h(SharedNavBar, {
    pages: MONITOR_PAGES,
    currentPage,
    title: 'MAESTRO',
    badge,
  });
};

export { NavBar };
