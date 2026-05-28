import { colors, fontFamily } from '../theme/tokens';

const statusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'healthy':
      return colors.success;
    case 'degraded':
      return colors.accent;
    default:
      return colors.error;
  }
};

interface ProviderHealthBadgeProps {
  status: string;
}

export function ProviderHealthBadge({ status }: ProviderHealthBadgeProps) {
  const color = statusColor(status);

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      fontFamily,
      fontSize: '13px',
    }}>
      <span
        data-testid="health-dot"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
        }}
      />
      <span style={{
        color,
        textTransform: 'uppercase',
        fontWeight: 600,
        fontSize: '11px',
      }}>
        {status}
      </span>
    </span>
  );
}
