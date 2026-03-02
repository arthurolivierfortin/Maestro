// @ts-nocheck
/**
 * HelpOverlay — Global keyboard shortcut overlay for maestro-code.
 *
 * Shows context-sensitive shortcuts based on the current page.
 * Toggled by pressing `?` on any page (when input is not focused).
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.ts';

// ── Shortcut definitions per context ─────────────────────────

const SHORTCUTS = {
  global: [
    { key: '/',       label: 'Focus input bar' },
    { key: 'Esc',     label: 'Return to navigation / close' },
    { key: 'Ctrl+C',  label: 'Cancel task or quit' },
    { key: '?',       label: 'Toggle this help' },
    { key: 'q',       label: 'Quit' },
  ],
  pages: [
    { key: 'h', label: 'Home' },
    { key: 'a', label: 'Agent' },
    { key: 's', label: 'Spaces' },
    { key: 'f', label: 'Foundry' },
    { key: 'c', label: 'Catalog' },
    { key: 'm', label: 'Models' },
  ],
  agent: [
    { key: 'j / k',   label: 'Scroll conversation' },
    { key: 'g',        label: 'Go to session monitor' },
  ],
  home: [
    { key: 'Up/Down',  label: 'Navigate sessions' },
    { key: 'Enter',    label: 'Open session' },
    { key: 'PgUp/Dn',  label: 'Page through sessions' },
  ],
  spaces: [
    { key: '1 / 2 / 3', label: 'Repos / Workspaces / Sessions' },
    { key: 'Up/Down',   label: 'Navigate list' },
    { key: 'Enter',     label: 'Open selected' },
    { key: 'd',         label: 'Delete session' },
    { key: 'r',         label: 'Toggle running filter' },
  ],
  foundry: [
    { key: 'Up/Down', label: 'Navigate blocks' },
    { key: 'Enter',   label: 'Open block detail' },
    { key: 'Space',   label: 'Toggle expanded' },
  ],
  catalog: [
    { key: '1-4',     label: 'Filter: All / Workflows / Agents / Tools' },
    { key: 'Up/Down', label: 'Navigate blocks' },
    { key: 'Enter',   label: 'Open block detail' },
    { key: 'Space',   label: 'Toggle expanded' },
    { key: 'Tab',     label: 'Cycle type filter' },
  ],
  models: [
    { key: 'Up/Down', label: 'Navigate models' },
    { key: 'Enter',   label: 'Open model detail' },
  ],
  commands: [
    { key: '/help',   label: 'Show available commands' },
    { key: '/status', label: 'Show session status' },
    { key: '/new',    label: 'New conversation' },
    { key: '/clear',  label: 'Clear conversation' },
    { key: '/stop',   label: 'Cancel current task' },
    { key: '/purge',  label: 'Delete idle sessions' },
    { key: '/quit',   label: 'Quit' },
  ],
};

// ── Section renderer ─────────────────────────────────────────

const Section = ({ title, items }) => {
  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true, color: theme.panel.borderFocused }, `  ${title}`),
    ...items.map((item, i) =>
      h(Box, { key: `${title}-${i}`, flexDirection: 'row', paddingLeft: 2 },
        h(Text, { color: theme.shortcut.key }, `${item.key.padEnd(14)}`),
        h(Text, { color: theme.text.muted }, item.label),
      )
    ),
    h(Text, null, ''),
  );
};

// ── HelpOverlay component ────────────────────────────────────

const HelpOverlay = ({ currentPage, onClose }) => {
  const pageKey = currentPage || 'agent';
  const pageShortcuts = SHORTCUTS[pageKey] || [];

  const pageName = pageKey.charAt(0).toUpperCase() + pageKey.slice(1);

  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    flexGrow: 1,
  },
    h(Box, {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: theme.panel.borderFocused,
      paddingX: 2,
      paddingY: 1,
      width: 54,
    },
      h(Text, { bold: true, color: theme.panel.borderFocused }, '  Maestro Code — Keyboard Shortcuts'),
      h(Text, null, ''),
      h(Section, { title: 'Global', items: SHORTCUTS.global }),
      h(Section, { title: 'Pages', items: SHORTCUTS.pages }),
      pageShortcuts.length > 0
        ? h(Section, { title: `${pageName} Page`, items: pageShortcuts })
        : null,
      h(Section, { title: 'Commands', items: SHORTCUTS.commands }),
      h(Text, { color: theme.text.muted }, '  Press ? or Esc to close'),
    ),
  );
};

export { HelpOverlay };
