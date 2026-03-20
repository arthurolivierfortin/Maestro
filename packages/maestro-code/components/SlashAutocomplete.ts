/**
 * SlashAutocomplete -- Dropdown autocomplete for slash commands.
 *
 * Appears above the TaskInputBar when input starts with '/'.
 * Filters commands as the user types, supports arrow keys + Enter to select.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';

// ── Available slash commands ──────────────────────────────────

export interface SlashCommand {
  command: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/help', description: 'Show available commands' },
  { command: '/status', description: 'System health + active sessions' },
  { command: '/spaces', description: 'Sessions list' },
  { command: '/sessions', description: 'Sessions list (alias)' },
  { command: '/foundry', description: 'My blocks' },
  { command: '/catalog', description: 'Block catalog' },
  { command: '/models', description: 'LLM models + providers' },
  { command: '/session', description: 'Session monitor (+ id)' },
  { command: '/block', description: 'Block details (+ id)' },
  { command: '/model', description: 'Model details (+ id)' },
  { command: '/workspace', description: 'Workspace details (+ id)' },
  { command: '/workspaces', description: 'Workspaces list' },
  { command: '/repos', description: 'Repos list' },
  { command: '/repo', description: 'Repo details (+ id)' },
  { command: '/permissions', description: 'Session permissions diff (+ id)' },
  { command: '/new', description: 'Start a new conversation' },
  { command: '/clear', description: 'Clear conversation' },
  { command: '/stop', description: 'Cancel the current task' },
  { command: '/purge', description: 'Delete idle sessions' },
  { command: '/costs', description: 'View/set cost limits' },
  { command: '/agent', description: 'Show or switch active agent' },
  { command: '/create-agent', description: 'Create agent via block-forge' },
  { command: '/playground', description: 'Model playground' },
  { command: '/quit', description: 'Quit' },
];

// ── Component ─────────────────────────────────────────────────

interface SlashAutocompleteProps {
  /** Current input value */
  input: string;
  /** Index of highlighted suggestion (managed by parent) */
  selectedIndex: number;
  /** Max number of visible suggestions */
  maxVisible?: number;
}

const SlashAutocomplete = ({ input, selectedIndex, maxVisible = 8 }: SlashAutocompleteProps) => {
  const query = input.toLowerCase();
  const filtered = SLASH_COMMANDS.filter(cmd =>
    cmd.command.startsWith(query)
  );

  if (filtered.length === 0) return null;

  const visible = filtered.slice(0, maxVisible);
  const safeIndex = Math.min(selectedIndex, visible.length - 1);

  return h(Box, {
    flexDirection: 'column',
    borderStyle: 'single' as const,
    borderColor: 'gray',
    paddingX: 1,
    marginLeft: 1,
    marginRight: 1,
    flexShrink: 0,
  },
    ...visible.map((cmd, i) => {
      const isSelected = i === safeIndex;
      return h(Box, { key: cmd.command, flexDirection: 'row' },
        h(Text, { color: isSelected ? 'cyan' : 'gray' }, isSelected ? '> ' : '  '),
        h(Text, { color: isSelected ? 'cyan' : 'white', bold: isSelected }, cmd.command.padEnd(18)),
        h(Text, { color: 'gray', dimColor: !isSelected }, cmd.description),
      );
    }),
    filtered.length > maxVisible
      ? h(Text, { color: 'gray', dimColor: true }, `  +${filtered.length - maxVisible} more`)
      : null,
  );
};

export { SlashAutocomplete };
