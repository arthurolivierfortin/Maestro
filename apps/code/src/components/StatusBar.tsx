import { colors, spacing, fontFamily } from '../theme/tokens';
import { useBackendStatus } from '../hooks/useBackendStatus';

export function StatusBar() {
  const { connected, checking } = useBackendStatus();

  const statusColor = checking ? colors.muted : connected ? colors.success : colors.error;
  const statusText = checking ? 'Checking...' : connected ? 'Connected' : 'Disconnected';

  return (
    <footer style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
      padding: `${spacing.xs} ${spacing.md}`,
      borderTop: `1px solid ${colors.border}`,
      fontFamily,
      fontSize: '12px',
      color: colors.muted,
      backgroundColor: colors.bg,
    }}>
      <span style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: statusColor,
      }} />
      <span>Backend: {statusText}</span>
    </footer>
  );
}
