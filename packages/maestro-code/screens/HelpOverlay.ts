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
} from '@maestro/tui/theme';

const SECTIONS = [
  {
    title: 'Navigation',
    shortcuts: [
      { key: 'A', desc: 'Go to Agent (Home)' },
      { key: 'C', desc: 'Go to Catalog' },
      { key: 'S', desc: 'Go to Sessions' },
      { key: 'M', desc: 'Go to Models' },
      { key: 'Tab', desc: 'Cycle screens (from browser)' },
      { key: 'Esc', desc: 'Go back' },
    ],
  },
  {
    title: 'Agent — Input',
    shortcuts: [
      { key: 'Enter', desc: 'Submit task / message' },
      { key: '↑/↓', desc: 'Input history' },
      { key: 'Ctrl+A', desc: 'Cursor to start' },
      { key: 'Ctrl+E', desc: 'Cursor to end' },
      { key: 'Ctrl+D', desc: 'Open session detail (during session)' },
      { key: '/session', desc: 'Open session detail (slash command)' },
      { key: 'J', desc: 'Join agent (go to where agent is)' },
    ],
  },
  {
    title: 'Cockpit — Panels',
    shortcuts: [
      { key: 'Tab', desc: 'Cycle panel focus (hero→tree→log→llm)' },
      { key: 'Esc', desc: 'Return to input / exit zoom' },
      { key: 'z', desc: 'Zoom focused panel full-screen' },
      { key: '↑/↓', desc: 'Navigate tree / scroll log' },
      { key: '←/→', desc: 'Collapse / expand tree nodes' },
      { key: 'Enter', desc: 'Toggle tree node expand' },
      { key: 'Click', desc: 'Focus clicked panel' },
      { key: 'Scroll', desc: 'Scroll in focused panel' },
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
