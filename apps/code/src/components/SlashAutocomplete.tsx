import { filterCommands } from '../slash/SlashCommandParser';
import { colors, spacing, fontFamily } from '../theme/tokens';

interface SlashAutocompleteProps {
  input: string;
  selectedIndex: number;
}

export function SlashAutocomplete({ input, selectedIndex }: SlashAutocompleteProps) {
  const filtered = filterCommands(input);
  if (filtered.length === 0) return null;

  const safeIndex = Math.min(selectedIndex, filtered.length - 1);

  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: 0,
      right: 0,
      border: `1px solid ${colors.border}`,
      backgroundColor: colors.bg,
      fontFamily,
      fontSize: '13px',
      zIndex: 10,
      maxHeight: '200px',
      overflowY: 'auto',
    }}>
      {filtered.map((cmd, i) => {
        const isSelected = i === safeIndex;
        return (
          <div
            key={cmd.command}
            data-testid="slash-item"
            style={{
              padding: `${spacing.xs} ${spacing.sm}`,
              color: isSelected ? colors.accent : colors.fg,
              backgroundColor: isSelected ? colors.border : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              gap: spacing.sm,
            }}
          >
            <span style={{ fontWeight: 700 }}>{cmd.command}</span>
            <span style={{ color: colors.muted }}>{cmd.description}</span>
          </div>
        );
      })}
    </div>
  );
}
