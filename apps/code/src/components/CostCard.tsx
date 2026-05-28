import { colors, spacing, fontFamily } from '../theme/tokens';

interface CostCardProps {
  label: string;
  value: string;
  subLabel?: string;
}

export function CostCard({ label, value, subLabel }: CostCardProps) {
  return (
    <div style={{
      padding: spacing.md,
      border: `1px solid ${colors.border}`,
      borderRadius: '4px',
      fontFamily,
      minWidth: '120px',
    }}>
      <div style={{ color: colors.muted, fontSize: '11px', marginBottom: spacing.xs }}>
        {label}
      </div>
      <div style={{ color: colors.accent, fontSize: '18px', fontWeight: 700 }}>
        {value}
      </div>
      {subLabel && (
        <div style={{ color: colors.muted, fontSize: '11px', marginTop: spacing.xs }}>
          {subLabel}
        </div>
      )}
    </div>
  );
}
