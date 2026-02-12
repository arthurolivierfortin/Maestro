// @ts-nocheck
/**
 * NavBar — Top navigation bar with configurable page tabs.
 *
 * Shows: [H]ome [S]paces [F]oundry [C]atalog [M]odels
 * Active page is highlighted. Supports custom pages via props.
 *
 * Props:
 *   currentPage    string
 *   sessionCount   number
 *   runningCount   number
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { semantic } from '../../theme/colors.ts';

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
      h(Text, { color: semantic.panel.borderFocused, bold: true }, '['),
      h(Text, { color: semantic.panel.borderFocused, bold: true }, hotkey),
      h(Text, { color: semantic.panel.borderFocused, bold: true }, ']'),
      h(Text, { color: semantic.panel.borderFocused, bold: true }, label),
    );
  }
  return h(Text, null,
    h(Text, { color: semantic.shortcut.bracket, dimColor: true }, '['),
    h(Text, { color: semantic.shortcut.key }, hotkey),
    h(Text, { color: semantic.shortcut.bracket, dimColor: true }, ']'),
    h(Text, { color: semantic.text.muted }, label),
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

  const tabElements = [];
  for (let i = 0; i < tabs.length; i++) {
    tabElements.push(tabs[i]);
    if (i < tabs.length - 1) {
      tabElements.push(h(Text, { key: `nav-sp-${i}` }, '  '));
    }
  }

  const badge = sessionCount > 0
    ? h(Text, { color: semantic.text.muted },
        `  \u2022 `,
        h(Text, { color: semantic.text.primary }, String(sessionCount)),
        h(Text, { color: semantic.text.muted }, ' sessions'),
        runningCount > 0
          ? h(Text, { color: semantic.status.running }, ` (${runningCount} running)`)
          : null,
      )
    : null;

  return h(Box, {
    borderStyle: 'single',
    borderColor: semantic.panel.border,
    paddingLeft: 1,
    paddingRight: 1,
    height: 3,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
    h(Box, { flexDirection: 'row' },
      h(Text, { color: semantic.panel.borderFocused, bold: true }, 'MAESTRO'),
      h(Text, null, '  '),
      ...tabElements,
    ),
    h(Box, { flexDirection: 'row' },
      badge,
      h(Text, { color: semantic.text.muted, dimColor: true }, '  Ctrl+'),
      h(Text, { color: semantic.shortcut.key, dimColor: true }, '\u2190\u2192'),
    ),
  );
};

export { NavBar };
