// @ts-nocheck
/**
 * HelpOverlay — Keyboard shortcuts help screen.
 *
 * Shows context-aware keyboard shortcuts.
 * Press ? to toggle, Esc to close.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { Panel } from '@maestro/tui/components';
import {
  inkTheme as theme,
  primary, muted, bold,
} from '@maestro/tui/theme/ink';

const SECTIONS = [
  {
    title: 'Navigation',
    shortcuts: [
      { key: 'A', desc: 'Go to Agent (Home)' },
      { key: 'C', desc: 'Go to Catalog' },
      { key: 'S', desc: 'Go to Sessions' },
      { key: 'M', desc: 'Go to Models' },
      { key: 'Esc', desc: 'Go back' },
    ],
  },
  {
    title: 'Agent',
    shortcuts: [
      { key: 'J', desc: 'Join agent (go to where agent is)' },
      { key: 'Enter', desc: 'Submit task / message' },
      { key: '↑/↓', desc: 'Input history' },
      { key: 'Ctrl+A', desc: 'Cursor to start' },
      { key: 'Ctrl+E', desc: 'Cursor to end' },
    ],
  },
  {
    title: 'Lists',
    shortcuts: [
      { key: '↑/↓', desc: 'Navigate items' },
      { key: 'Enter', desc: 'Open / select' },
      { key: 'Esc', desc: 'Back' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { key: '?', desc: 'Toggle this help' },
      { key: 'Ctrl+C', desc: 'Quit' },
      { key: 'Ctrl+V', desc: 'Toggle voice mode' },
    ],
  },
];

interface HelpOverlayProps {
  onClose: () => void;
}

const HelpOverlay = ({ onClose }: HelpOverlayProps) => {
  return h(Panel, {
    title: 'HELP',
    focused: true,
    flexGrow: 1,
  },
    h(Box, { flexDirection: 'column', padding: 1 },
      ...SECTIONS.map((section) =>
        h(Box, { key: section.title, flexDirection: 'column', marginBottom: 1 },
          bold(section.title),
          ...section.shortcuts.map((sc) =>
            h(Box, { key: sc.key, flexDirection: 'row', paddingLeft: 1 },
              h(Text, {
                color: theme.shortcut.key,
              }, sc.key.padEnd(12)),
              muted(sc.desc),
            )
          ),
        )
      ),
      h(Box, { marginTop: 1 },
        muted('Press ? or Esc to close'),
      ),
    ),
  );
};

export { HelpOverlay };
