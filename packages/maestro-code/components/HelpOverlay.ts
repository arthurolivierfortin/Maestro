/**
 * HelpOverlay -- Global keyboard shortcut overlay for maestro-code.
 *
 * Shows context-sensitive shortcuts.
 * - Classic mode: page navigation (h/a/s/f/c/m), page-specific shortcuts, commands
 * - Chat-first mode: global shortcuts, slash commands, widget shortcuts
 *
 * Toggled by pressing `?` (when input is not focused).
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.ts';

// -- Shortcut definitions per context -----------------------------------

const SHORTCUTS: Record<string, ShortcutItem[]> = {
  global: [
    { key: '/',       label: 'Focus input bar' },
    { key: 'Esc',     label: 'Return to navigation / close widget' },
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
    { key: 'P',       label: 'Playground (test model)' },
  ],
  // Slash commands (shown in both modes)
  commands: [
    { key: '/help',   label: 'Show available commands' },
    { key: '/status', label: 'Show session status' },
    { key: '/new',    label: 'New conversation' },
    { key: '/clear',  label: 'Clear conversation' },
    { key: '/stop',   label: 'Cancel current task' },
    { key: '/purge',        label: 'Delete idle sessions' },
    { key: '/costs',        label: 'View/set cost limits' },
    { key: '/create-agent', label: 'Create an agent via block-forge' },
    { key: '/playground',   label: 'Open model playground' },
    { key: '/quit',         label: 'Quit' },
  ],
  // Navigation commands (chat-first only)
  slashNav: [
    { key: '/status',          label: 'System health + active sessions' },
    { key: '/spaces',          label: 'Sessions list' },
    { key: '/spaces repos',    label: 'Repos list' },
    { key: '/foundry',         label: 'My blocks' },
    { key: '/catalog',         label: 'Block catalog' },
    { key: '/catalog agents',  label: 'Catalog filtered to agents' },
    { key: '/models',          label: 'LLM models + providers' },
    { key: '/session <id>',    label: 'Session monitor' },
    { key: '/block <id>',      label: 'Block details' },
    { key: '/model <id>',      label: 'Model details' },
    { key: '/workspace <id>',  label: 'Workspace details' },
    { key: '/permissions <id>', label: 'Session permissions diff' },
  ],
  // Widget keyboard shortcuts (chat-first only)
  widgetKeys: [
    { key: 'j / k',    label: 'Navigate within focused widget' },
    { key: 'Enter',    label: 'Open / select item' },
    { key: 'Space',    label: 'Expand / collapse item' },
    { key: 'Tab',      label: 'Cycle tabs / panels' },
    { key: 'z',        label: 'Zoom panel (in session monitor)' },
    { key: 'Esc',      label: 'Close / collapse widget' },
  ],
};

// -- Section renderer ---------------------------------------------------

interface ShortcutItem {
  key: string;
  label: string;
}

interface SectionProps {
  title: string;
  items: ShortcutItem[];
}

const Section = ({ title, items }: SectionProps) => {
  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true, color: theme.panel.borderFocused }, `  ${title}`),
    ...items.map((item, i) =>
      h(Box, { key: `${title}-${i}`, flexDirection: 'row', paddingLeft: 2 },
        h(Text, { color: theme.shortcut.key }, `${item.key.padEnd(18)}`),
        h(Text, { color: theme.text.muted }, item.label),
      )
    ),
    h(Text, null, ''),
  );
};

// -- HelpOverlay component -----------------------------------------------

interface HelpOverlayProps {
  currentPage?: string;
  onClose?: () => void;
  /** When true, show classic mode layout with page navigation. Default: false. */
  classic?: boolean;
}

const HelpOverlay = ({ currentPage, onClose, classic }: HelpOverlayProps) => {
  if (classic) {
    // Classic mode: same as the old layout (pages + page-specific + commands)
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
        h(Text, { bold: true, color: theme.panel.borderFocused }, '  Maestro Code -- Keyboard Shortcuts'),
        h(Text, null, ''),
        h(Section, { title: 'Global', items: SHORTCUTS.global }),
        h(Section, { title: 'Page Navigation', items: SHORTCUTS.pages }),
        pageShortcuts.length > 0
          ? h(Section, { title: `${pageName} Page`, items: pageShortcuts })
          : null,
        h(Section, { title: 'Commands', items: SHORTCUTS.commands }),
        h(Text, { color: theme.text.muted }, '  Press ? or Esc to close'),
      ),
    );
  }

  // Chat-first mode: global + slash commands + widget shortcuts
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
      width: 58,
    },
      h(Text, { bold: true, color: theme.panel.borderFocused }, '  Maestro Code -- Keyboard Shortcuts'),
      h(Text, null, ''),
      h(Section, { title: 'Global Shortcuts', items: SHORTCUTS.global }),
      h(Section, { title: 'Slash Commands', items: SHORTCUTS.commands }),
      h(Section, { title: 'Navigation Commands', items: SHORTCUTS.slashNav }),
      h(Section, { title: 'Widget Shortcuts', items: SHORTCUTS.widgetKeys }),
      h(Text, { color: theme.text.muted }, '  Press ? or Esc to close'),
    ),
  );
};

export { HelpOverlay };
