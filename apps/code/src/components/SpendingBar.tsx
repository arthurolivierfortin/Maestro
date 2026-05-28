import { colors, spacing, fontFamily } from '../theme/tokens';

interface SpendingBarProps {
  label: string;
  current: number;
  max: number;
  enforcement?: string;
}

export function SpendingBar({ label, current, max, enforcement }: SpendingBarProps) {
  if (max <= 0) {
    return (
      <div style={{ padding: `${spacing.xs} ${spacing.md}`, fontFamily, fontSize: '12px' }}>
        <span style={{ color: colors.fg }}>{label}</span>
        {' '}
        <span style={{ color: colors.muted }}>No limit</span>
      </div>
    );
  }

  const pct = Math.min(Math.round((current / max) * 100), 100);
  const barColor = pct > 90 ? colors.error : pct > 60 ? colors.accent : colors.success;

  return (
    <div style={{ padding: `${spacing.xs} ${spacing.md}`, fontFamily, fontSize: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <span style={{ color: colors.fg }}>
          {label}
          {enforcement && (
            <span style={{ color: colors.muted, fontSize: '10px', marginLeft: spacing.xs }}>
              {enforcement}
            </span>
          )}
        </span>
        <span style={{ color: colors.muted }}>
          ${current.toFixed(2)} / ${max.toFixed(2)}
        </span>
      </div>
      <div style={{
        height: '6px',
        backgroundColor: colors.border,
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          backgroundColor: barColor,
          borderRadius: '3px',
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ textAlign: 'right', color: colors.muted, fontSize: '10px', marginTop: '2px' }}>
        {pct}%
      </div>
    </div>
  );
}
