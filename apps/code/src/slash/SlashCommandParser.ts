export interface SlashCommand {
  command: string;
  description: string;
}

export interface ParsedCommand {
  command: string;
  args: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/help', description: 'Show shortcuts and commands' },
  { command: '/clear', description: 'Clear conversation' },
  { command: '/new', description: 'Start a new conversation' },
  { command: '/stop', description: 'Stop current generation' },
  { command: '/quit', description: 'Quit application' },
];

const knownCommands = new Set(SLASH_COMMANDS.map(c => c.command));

export function parseSlashCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const spaceIdx = trimmed.indexOf(' ');
  const cmdStr = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();
  const lowerCmd = cmdStr.toLowerCase();

  if (!knownCommands.has(lowerCmd)) return null;

  return { command: lowerCmd.slice(1), args };
}

export function filterCommands(input: string): SlashCommand[] {
  const query = input.toLowerCase();
  return SLASH_COMMANDS.filter(cmd => cmd.command.startsWith(query));
}
