// @ts-nocheck
/**
 * HelpOverlay — Keyboard shortcuts help screen.
 *
 * The Spatial Navigation section is AUTO-GENERATED from PageRegistry.
 * Other sections are static.
 *
 * Press ? to toggle, Esc to close.
 *
 * Phase 41-G: replaces screens/HelpOverlay.ts.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { Panel } from '@maestro/tui/components';
import {
  inkTheme as theme,
  primary, muted, bold,
} from '@maestro/tui/theme';
import type { PageRegistry } from '../registry/PageRegistry.ts';
import type { Direction } from '../registry/types.ts';

// ── Direction key labels ─────────────────────────────────────

const DIR_KEY: Record<string, string> = {
  '0,-1': 'Ctrl+Up',
  '0,1': 'Ctrl+Down',
  '-1,0': 'Ctrl+Left',
  '1,0': 'Ctrl+Right',
};

const DIR_ARROW: Record<Direction, string> = {
  up: '↑', down: '↓', left: '←', right: '→',
};

// ── Static sections ──────────────────────────────────────────

interface ShortcutDef {
  key: string;
  desc: string;
}

interface SectionDef {
  title: string;
  shortcuts: ShortcutDef[];
}

const STATIC_SECTIONS: SectionDef[] = [
  {
    title: 'Agent Page',
    shortcuts: [
      { key: 'Enter', desc: 'Submit task / message' },
      { key: '↑/↓', desc: 'Input history' },
      { key: 'Ctrl+A', desc: 'Cursor to start' },
      { key: 'Ctrl+E', desc: 'Cursor to end' },
      { key: 'J', desc: 'Join agent (teleport to agent page)' },
    ],
  },
  {
    title: 'Execution Page',
    shortcuts: [
      { key: 'Tab', desc: 'Cycle panel focus (tree → log → llm)' },
      { key: 'Esc', desc: 'Return to input / exit zoom' },
      { key: 'z', desc: 'Zoom focused panel full-screen' },
      { key: '↑/↓', desc: 'Navigate tree / scroll log' },
      { key: '←/→', desc: 'Collapse / expand tree nodes' },
    ],
  },
  {
    title: 'List Pages',
    shortcuts: [
      { key: '↑/↓', desc: 'Navigate items' },
      { key: 'Enter', desc: 'Open / select item' },
      { key: 'Esc', desc: 'Back to list / home' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { key: 'Ctrl+K', desc: 'Command palette' },
      { key: '?', desc: 'Toggle this help' },
      { key: 'Ctrl+C', desc: 'Quit' },
      { key: 'Ctrl+V', desc: 'Toggle voice mode' },
      { key: 'Ctrl+D', desc: 'Go to Execution page' },
      { key: 'Ctrl+Tab', desc: 'Quick-switch (last 2 pages)' },
    ],
  },
];

// ── Build spatial nav section from registry ──────────────────

function buildSpatialSection(registry: PageRegistry): SectionDef {
  const pages = registry.getAll();
  const shortcuts: ShortcutDef[] = [];

  for (const page of pages) {
    const posKey = `${page.position.x},${page.position.y}`;
    const ctrlKey = DIR_KEY[posKey];
    if (ctrlKey) {
      shortcuts.push({
        key: ctrlKey,
        desc: `${page.icon} ${page.label}`,
      });
    }
  }

  // Agent (center) — accessed via Esc
  const agent = pages.find(p => p.position.x === 0 && p.position.y === 0);
  if (agent) {
    shortcuts.unshift({
      key: 'Esc',
      desc: `${agent.icon} ${agent.label} (home)`,
    });
  }

  return {
    title: 'Spatial Navigation',
    shortcuts,
  };
}

// ── Props ────────────────────────────────────────────────────

export interface HelpOverlayProps {
  onClose: () => void;
  registry?: PageRegistry;
}

// ── Component ────────────────────────────────────────────────

const HelpOverlay = ({ onClose, registry }: HelpOverlayProps) => {
  // Build sections: spatial (auto-generated) + static
  const sections: SectionDef[] = [];

  if (registry) {
    sections.push(buildSpatialSection(registry));
  }
  sections.push(...STATIC_SECTIONS);

  return h(Panel, {
    title: 'HELP',
    focused: true,
    flexGrow: 1,
  },
    h(Box, { flexDirection: 'column', padding: 1 },
      ...sections.map((section) =>
        h(Box, { key: section.title, flexDirection: 'column', marginBottom: 1 },
          bold(section.title),
          ...section.shortcuts.map((sc) =>
            h(Box, { key: sc.key, flexDirection: 'row', paddingLeft: 1 },
              h(Text, {
                color: theme.shortcut.key,
              }, sc.key.padEnd(14)),
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
