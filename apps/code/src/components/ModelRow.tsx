import { colors, spacing, fontFamily } from '../theme/tokens';
import type { CompatibleModel } from '../services/providerService';

interface ModelRowProps {
  model: CompatibleModel;
}

export function ModelRow({ model }: ModelRowProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md,
      padding: `${spacing.sm} ${spacing.md}`,
      borderBottom: `1px solid ${colors.border}`,
      fontFamily,
    }}>
      <span style={{
        color: colors.fg,
        fontSize: '13px',
        fontWeight: 600,
        flex: 1,
        minWidth: 0,
      }}>
        {model.name}
      </span>
      {model.category && (
        <span style={{
          color: colors.muted,
          fontSize: '11px',
          minWidth: '60px',
        }}>
          {model.category}
        </span>
      )}
      {model.recommended && (
        <span style={{
          color: colors.accent,
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>
          RECOMMENDED
        </span>
      )}
    </div>
  );
}
