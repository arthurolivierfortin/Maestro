import { useEffect } from 'react';
import { SLASH_COMMANDS } from '../slash/SlashCommandParser';
import { colors, spacing, fontFamily } from '../theme/tokens';

interface HelpOverlayProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: '1-5', description: 'Navigate pages' },
  { key: '?', description: 'Toggle help' },
  { key: 'Esc', description: 'Close overlay' },
  { key: 'Enter', description: 'Send message' },
  { key: 'Shift+Enter', description: 'New line' },
];

export function HelpOverlay({ onClose }: HelpOverlayProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      data-testid="help-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        data-testid="help-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          padding: spacing.lg,
          borderRadius: '8px',
          fontFamily,
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{
          color: colors.accent,
          margin: `0 0 ${spacing.md} 0`,
          fontSize: '16px',
          fontWeight: 700,
        }}>
          Keyboard Shortcuts
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          {SHORTCUTS.map((s) => (
            <div key={s.key} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: `${spacing.xs} 0`,
            }}>
              <span style={{
                color: colors.accent,
                fontWeight: 700,
                fontFamily,
                fontSize: '13px',
                minWidth: '120px',
              }}>
                {s.key}
              </span>
              <span style={{ color: colors.fg, fontSize: '13px', flex: 1 }}>
                {s.description}
              </span>
            </div>
          ))}
        </div>

        <h2 style={{
          color: colors.accent,
          margin: `${spacing.lg} 0 ${spacing.md} 0`,
          fontSize: '16px',
          fontWeight: 700,
        }}>
          Slash Commands
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          {SLASH_COMMANDS.map((cmd) => (
            <div key={cmd.command} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: `${spacing.xs} 0`,
            }}>
              <span style={{
                color: colors.accent,
                fontWeight: 700,
                fontFamily,
                fontSize: '13px',
                minWidth: '120px',
              }}>
                {cmd.command}
              </span>
              <span style={{ color: colors.fg, fontSize: '13px', flex: 1 }}>
                {cmd.description}
              </span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: spacing.lg,
          paddingTop: spacing.md,
          borderTop: `1px solid ${colors.border}`,
          color: colors.muted,
          fontSize: '12px',
          textAlign: 'center',
        }}>
          Press Esc or ? to close
        </div>
      </div>
    </div>
  );
}
