import { describe, it, expect } from 'vitest';
import { parseSlashCommand, SLASH_COMMANDS, filterCommands } from '../SlashCommandParser';

describe('SlashCommandParser', () => {
  describe('parseSlashCommand', () => {
    it('returns parsed command for known command', () => {
      const result = parseSlashCommand('/help');
      expect(result).toEqual({ command: 'help', args: '' });
    });

    it('returns parsed command with args', () => {
      const result = parseSlashCommand('/clear all');
      expect(result).toEqual({ command: 'clear', args: 'all' });
    });

    it('returns null for unknown command', () => {
      const result = parseSlashCommand('/unknown');
      expect(result).toBeNull();
    });

    it('returns null for non-slash input', () => {
      const result = parseSlashCommand('hello');
      expect(result).toBeNull();
    });

    it('returns null for empty input', () => {
      const result = parseSlashCommand('');
      expect(result).toBeNull();
    });

    it('is case-insensitive', () => {
      const result = parseSlashCommand('/HELP');
      expect(result).toEqual({ command: 'help', args: '' });
    });

    it('trims whitespace', () => {
      const result = parseSlashCommand('  /help  ');
      expect(result).toEqual({ command: 'help', args: '' });
    });
  });

  describe('filterCommands', () => {
    it('returns all commands for "/" input', () => {
      const result = filterCommands('/');
      expect(result.length).toBe(SLASH_COMMANDS.length);
    });

    it('filters commands matching prefix', () => {
      const result = filterCommands('/cl');
      expect(result).toEqual([
        expect.objectContaining({ command: '/clear' }),
      ]);
    });

    it('returns empty array for no matches', () => {
      const result = filterCommands('/xyz');
      expect(result).toEqual([]);
    });

    it('is case-insensitive', () => {
      const result = filterCommands('/HE');
      expect(result).toEqual([
        expect.objectContaining({ command: '/help' }),
      ]);
    });
  });

  describe('SLASH_COMMANDS', () => {
    it('contains the 5 V1 commands', () => {
      const names = SLASH_COMMANDS.map(c => c.command);
      expect(names).toContain('/help');
      expect(names).toContain('/clear');
      expect(names).toContain('/quit');
      expect(names).toContain('/new');
      expect(names).toContain('/stop');
    });

    it('each command has a description', () => {
      for (const cmd of SLASH_COMMANDS) {
        expect(cmd.description.length).toBeGreaterThan(0);
      }
    });
  });
});
