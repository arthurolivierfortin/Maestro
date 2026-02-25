// @ts-nocheck
/**
 * CommandPalette — Modal full-screen fuzzy search (Ctrl+K).
 *
 * Categories:
 * - Navigation: auto-populated from PageRegistry
 * - Actions: New session, Switch model, Voice toggle, etc.
 * - Slash commands: all /commands from App.ts
 *
 * Uses useSelectableList from @maestro/tui for keyboard-driven selection.
 * Enter = execute, Esc = close.
 *
 * Phase 41-G.
 */

import { createElement as h, useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Panel } from '@maestro/tui/components';
import { useSelectableList } from '@maestro/tui/hooks';
import type { PageRegistry } from '../registry/PageRegistry.ts';

// ── Types ─────────────────────────────────────────────────────

export interface CommandItem {
  id: string;
  label: string;
  category: 'navigation' | 'action' | 'slash';
  shortcut?: string;
  action: string; // action id to pass back
}

export interface CommandPaletteProps {
  registry: PageRegistry;
  onExecute: (action: string) => void;
  onClose: () => void;
}

// ── Direction arrow for Ctrl shortcuts ───────────────────────

const DIR_KEY: Record<string, string> = {
  '0,-1': 'Ctrl+Up',
  '0,1': 'Ctrl+Down',
  '-1,0': 'Ctrl+Left',
  '1,0': 'Ctrl+Right',
};

// ── Build command list from registry ─────────────────────────

function buildCommands(registry: PageRegistry): CommandItem[] {
  const items: CommandItem[] = [];

  // Navigation: auto-populate from registry
  for (const page of registry.getAll()) {
    const posKey = `${page.position.x},${page.position.y}`;
    const shortcut = DIR_KEY[posKey] || '';
    items.push({
      id: `nav-${page.id}`,
      label: `Go to ${page.label}`,
      category: 'navigation',
      shortcut,
      action: `goto:${page.id}`,
    });
  }

  // Actions
  items.push(
    { id: 'act-help', label: 'Show Help', category: 'action', shortcut: '?', action: 'help' },
    { id: 'act-voice', label: 'Toggle Voice Mode', category: 'action', shortcut: 'Ctrl+V', action: 'voice' },
    { id: 'act-quit', label: 'Quit', category: 'action', shortcut: 'Ctrl+C', action: 'quit' },
    { id: 'act-home', label: 'Go Home (Agent)', category: 'action', shortcut: 'Esc', action: 'goto:agent' },
    { id: 'act-quickswitch', label: 'Quick Switch (last page)', category: 'action', shortcut: 'Ctrl+Tab', action: 'quickswitch' },
  );

  // Slash commands
  items.push(
    { id: 'slash-catalog', label: '/catalog', category: 'slash', action: 'goto:catalog' },
    { id: 'slash-spaces', label: '/spaces', category: 'slash', action: 'goto:spaces' },
    { id: 'slash-models', label: '/models', category: 'slash', action: 'goto:models' },
    { id: 'slash-execution', label: '/execution', category: 'slash', action: 'goto:execution' },
    { id: 'slash-help', label: '/help', category: 'slash', action: 'help' },
    { id: 'slash-quit', label: '/quit', category: 'slash', action: 'quit' },
  );

  return items;
}

// ── Fuzzy filter ─────────────────────────────────────────────

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  // Simple substring match + word-start matching
  if (t.includes(q)) return true;
  // Check if all chars appear in order (fuzzy)
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ── Category labels ──────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  action: 'Actions',
  slash: 'Slash Commands',
};

const CATEGORY_ORDER = ['navigation', 'action', 'slash'];

// ── Component ────────────────────────────────────────────────

const CommandPalette = ({ registry, onExecute, onClose }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const allCommands = useMemo(() => buildCommands(registry), [registry]);

  const filtered = useMemo(() => {
    return allCommands.filter(item =>
      fuzzyMatch(query, item.label) || fuzzyMatch(query, item.action)
    );
  }, [allCommands, query]);

  const list = useSelectableList({ itemCount: filtered.length, pageSize: 12, wrap: true });

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.return) {
      if (filtered.length > 0) {
        onExecute(filtered[list.selectedIndex].action);
        onClose();
      }
      return;
    }
    if (key.upArrow) { list.moveUp(); return; }
    if (key.downArrow) { list.moveDown(); return; }
    if (key.backspace || key.delete) {
      setQuery(q => q.slice(0, -1));
      list.reset();
      return;
    }
    // Printable character
    if (input && !key.ctrl && !key.meta && input.length === 1) {
      setQuery(q => q + input);
      list.reset();
    }
  });

  // Group filtered items by category for display
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [filtered]);

  // Build flat display list with category headers tracked
  let flatIndex = 0;
  const rows: Array<{ type: 'header'; label: string } | { type: 'item'; item: CommandItem; index: number }> = [];
  for (const cat of CATEGORY_ORDER) {
    const items = grouped[cat];
    if (!items || items.length === 0) continue;
    rows.push({ type: 'header', label: CATEGORY_LABELS[cat] || cat });
    for (const item of items) {
      rows.push({ type: 'item', item, index: flatIndex });
      flatIndex++;
    }
  }

  return h(Panel, {
    title: 'COMMAND PALETTE',
    focused: true,
    flexGrow: 1,
  },
    h(Box, { flexDirection: 'column', padding: 1 },
      // Search input
      h(Box, { marginBottom: 1 },
        h(Text, { color: 'cyan' }, '> '),
        h(Text, null, query || ''),
        h(Text, { color: 'gray', dimColor: true }, query ? '' : 'Type to search...'),
      ),
      // Results count
      h(Text, { color: 'gray', dimColor: true }, `${filtered.length} result${filtered.length !== 1 ? 's' : ''} ${list.positionLabel}`),
      h(Box, { height: 1 }),
      // Scrollable list
      ...rows.slice(list.scrollStart).map((row) => {
        if (row.type === 'header') {
          return h(Box, { key: `hdr-${row.label}` },
            h(Text, { color: 'yellow', bold: true }, row.label),
          );
        }
        const { item, index } = row;
        const isSelected = index === list.selectedIndex;
        return h(Box, {
          key: item.id,
          flexDirection: 'row',
          paddingLeft: 1,
        },
          h(Text, { color: isSelected ? 'cyan' : 'white', bold: isSelected, inverse: isSelected },
            isSelected ? '>' : ' ',
          ),
          h(Text, { color: isSelected ? 'cyan' : 'white', bold: isSelected },
            ` ${item.label}`,
          ),
          item.shortcut
            ? h(Text, { color: 'gray', dimColor: true }, `  ${item.shortcut}`)
            : null,
        );
      }),
      // Footer
      h(Box, { marginTop: 1 },
        h(Text, { color: 'gray', dimColor: true }, 'Enter select  Esc close'),
      ),
    ),
  );
};

export { CommandPalette };
