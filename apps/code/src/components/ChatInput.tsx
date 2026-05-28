import { useState, useCallback, KeyboardEvent } from 'react';
import { colors, spacing, fontFamily } from '../theme/tokens';

interface ChatInputProps {
  onSend: (value: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !isLoading) {
          onSend(value);
          setValue('');
        }
      }
    },
    [value, isLoading, onSend]
  );

  return (
    <div style={{
      padding: spacing.md,
      borderTop: `1px solid ${colors.border}`,
    }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder="Type a message..."
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
