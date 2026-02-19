import './ui.scss';

type Status = 'healthy' | 'running' | 'success' | 'warning' | 'error' | 'degraded' | 'down' | 'unknown' | 'pending' | 'paused';

interface StatusIndicatorProps {
  status: Status;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

const statusMap: Record<Status, string> = {
  healthy: 'success',
  running: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
  degraded: 'warning',
  down: 'error',
  unknown: 'muted',
  pending: 'muted',
  paused: 'warning',
};

export function StatusIndicator({ status, label, size = 'md', pulse = false, className = '' }: StatusIndicatorProps) {
  const color = statusMap[status] || 'muted';
  return (
    <span className={`ui-status ui-status--${color} ui-status--${size} ${pulse ? 'ui-status--pulse' : ''} ${className}`}>
      <span className="ui-status__dot" />
      {label && <span className="ui-status__label">{label || status}</span>}
    </span>
  );
}
