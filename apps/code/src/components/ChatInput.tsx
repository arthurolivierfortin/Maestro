import { useState, useCallback, KeyboardEvent } from 'react';
import { colors, spacing, fontFamily } from '../theme/tokens';
import { SlashAutocomplete } from './SlashAutocomplete';
import { parseSlashCommand, filterCommands } from '../slash/SlashCommandParser';

interface ChatInputProps {
  onSend: (value: string) => void;
  onSlashCommand: (command: string, args: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, onSlashCommand, isLoading }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    if (newValue.startsWith('/')) {
      setShowAutocomplete(true);
      setSelectedIndex(0);
    } else {
      setShowAutocomplete(false);
      setSelectedIndex(0);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (showAutocomplete) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowAutocomplete(false);
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const filtered = filterCommands(value);
          setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const filtered = filterCommands(value);
          if (filtered.length > 0) {
            const selected = filtered[Math.min(selectedIndex, filtered.length - 1)];
            const parsed = parseSlashCommand(selected.command);
            if (parsed) {
              onSlashCommand(parsed.command, parsed.args);
              setValue('');
              setShowAutocomplete(false);
              setSelectedIndex(0);
            }
          }
          return;
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !isLoading) {
          const parsed = parseSlashCommand(value);
          if (parsed) {
            onSlashCommand(parsed.command, parsed.args);
          } else {
            onSend(value);
          }
          setValue('');
          setShowAutocomplete(false);
          setSelectedIndex(0);
        }
      }
    },
    [value, isLoading, onSend, onSlashCommand, showAutocomplete, selectedIndex]
  );

  return (
    <div style={{
      padding: spacing.md,
      borderTop: `1px solid ${colors.border}`,
      position: 'relative',
    }}>
      {showAutocomplete && (
        <SlashAutocomplete input={value} selectedIndex={selectedIndex} />
      )}
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder="Type a message or / for commands..."
        rows={3}
        style={{
          width: '100%',
          backgroundColor: 'transparent',
          color: colors.fg,
          border: `1px solid ${colors.border}`,
          borderRadius: '4px',
          padding: spacing.sm,
          fontFamily,
          fontSize: '14px',
          resize: 'none',
          outline: 'none',
        }}
      />
    </div>
  );
}
