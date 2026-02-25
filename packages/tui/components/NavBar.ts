// @ts-nocheck
/**
 * NavBar — Top navigation bar with bracketed hotkey tabs.
 *
 * Data-driven: accepts pages as a prop.
 * Renders: TITLE  [H]ome  [S]paces  [F]oundry   |  badge  Ctrl+←→
 *
 * Props:
 *   pages        NavPage[] — tabs to display
 *   currentPage  string — active page key
 *   title        string — app name (default 'MAESTRO')
 *   badge        ReactNode — optional right-side badge element
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { inkTheme as theme } from '../theme/ink.ts';

export interface NavPage {
  key: string;
  hotkey: string;
  label: string;
}

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

const NavBar = ({ pages, currentPage = '', title = 'MAESTRO', badge = null }) => {
  const tabs = pages.map((page) =>
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

  return h(Box, {
    borderStyle: theme.panel.borderStyle,
    borderColor: theme.panel.border,
    paddingLeft: 1,
    paddingRight: 1,
    height: 3,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
    h(Box, { flexDirection: 'row', overflow: 'hidden', flexShrink: 1 },
      h(Text, { color: theme.panel.borderFocused, bold: true }, title),
      h(Text, null, '  '),
      ...tabElements,
    ),
    h(Box, { flexDirection: 'row', flexShrink: 0 },
      badge,
      h(Text, { color: theme.text.muted, dimColor: true }, '  Ctrl+'),
      h(Text, { color: theme.shortcut.key, dimColor: true }, '\u2190\u2192'),
    ),
  );
};

export { NavBar, NavTab };
