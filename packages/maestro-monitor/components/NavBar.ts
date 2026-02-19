// @ts-nocheck
/**
 * NavBar — Top navigation bar with 5 page tabs.
 *
 * Shows: [H]ome [S]paces [F]oundry [C]atalog [M]odels
 * Active page is highlighted in cyan/bold.
 *
 * Props:
 *   currentPage    'home' | 'spaces' | 'foundry' | 'catalog' | 'models'
 *   sessionCount   number — total sessions (shown as badge on Spaces)
 *   runningCount   number — running sessions (shown as badge on Spaces)
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { theme, icons } from '../theme.ts';

const PAGES = [
  { key: 'home',    hotkey: 'H', label: 'ome' },
  { key: 'spaces',  hotkey: 'S', label: 'paces' },
  { key: 'foundry', hotkey: 'F', label: 'oundry' },
  { key: 'catalog', hotkey: 'C', label: 'atalog' },
  { key: 'models',  hotkey: 'M', label: 'odels' },
];

const NavTab = ({ hotkey, label, isActive }) => {
  if (isActive) {
    return h(Text, { bold: true },
      h(Text, { color: theme.panel.borderFocused, bold: true }, '['),
      h(Text, { color: theme.panel.borderFocused, bold: true }, hotkey),
      h(Text, { color: theme.panel.borderFocused, bold: true }, ']'),
      h(Text, { color: theme.panel.borderFocused, bold: true }, label),
    );
  }
  return h(Text, null,
    h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
    h(Text, { color: theme.shortcut.key }, hotkey),
    h(Text, { color: theme.shortcut.bracket, dimColor: true }, ']'),
    h(Text, { color: theme.text.muted }, label),
  );
};

const NavBar = ({ currentPage = 'home', sessionCount = 0, runningCount = 0 }) => {
  const tabs = PAGES.map((page) =>
    h(NavTab, {
      key: page.key,
      hotkey: page.hotkey,
      label: page.label,
      isActive: currentPage === page.key,
    })
  );

  // Space-separated tabs
  const tabElements = [];
  for (let i = 0; i < tabs.length; i++) {
    tabElements.push(tabs[i]);
    if (i < tabs.length - 1) {
      tabElements.push(h(Text, { key: `nav-sp-${i}` }, '  '));
    }
  }

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

  return h(Box, {
    borderStyle: theme.panel.borderStyle,
    borderColor: theme.panel.border,
    paddingLeft: 1,
    paddingRight: 1,
    height: 3,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
    h(Box, { flexDirection: 'row' },
      h(Text, { color: theme.panel.borderFocused, bold: true }, 'MAESTRO'),
      h(Text, null, '  '),
      ...tabElements,
    ),
    h(Box, { flexDirection: 'row' },
      badge,
      h(Text, { color: theme.text.muted, dimColor: true }, '  Ctrl+'),
      h(Text, { color: theme.shortcut.key, dimColor: true }, '\u2190\u2192'),
    ),
  );
};

export { NavBar };
