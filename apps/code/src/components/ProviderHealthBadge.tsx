interface ProviderHealthBadgeProps {
  status: string;
}

const statusClass = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'healthy':
      return 'cok';
    case 'degraded':
      return 'cwarn';
    default:
      return 'cerr';
  }
};

const badgeKind = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'healthy':
      return 'ok';
    case 'degraded':
      return 'warn';
    default:
      return 'err';
  }
};

export function ProviderHealthBadge({ status }: ProviderHealthBadgeProps) {
  const colorClass = statusClass(status);

  return (
    <span className="row gap-6">
      <span
        data-testid="health-dot"
        className={colorClass}
        style={{ width: 8, height: 8, display: 'inline-block', background: 'currentColor' }}
      />
      <span className={`b ${badgeKind(status)}`}>{status}</span>
    </span>
  );
}
