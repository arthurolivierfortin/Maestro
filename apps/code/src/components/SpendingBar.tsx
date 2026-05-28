interface SpendingBarProps {
  label: string;
  current: number;
  max: number;
  enforcement?: string;
}

const BAR_WIDTH = 24;

export function SpendingBar({ label, current, max, enforcement }: SpendingBarProps) {
  if (max <= 0) {
    return (
      <div className="row gap-6" style={{ padding: '4px 14px', fontSize: 12 }}>
        <span className="c1">{label}</span>
        <span className="c3">No limit</span>
      </div>
    );
  }

  const pct = Math.min(Math.round((current / max) * 100), 100);
  const variant = pct > 90 ? 'err' : pct > 60 ? 'warn' : 'ok';
  const full = Math.round((pct / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - full;

  return (
    <div className="col" style={{ padding: '4px 14px', fontSize: 12 }}>
      <div className="row between">
        <span className="c1">
          {label}
          {enforcement && (
            <span className="c3" style={{ fontSize: 10, marginLeft: 6 }}>{enforcement}</span>
          )}
        </span>
        <span className="c2">
          ${current.toFixed(2)} / ${max.toFixed(2)}
        </span>
      </div>
      <div className="row between gap-8">
        <span className="bar-ascii" style={{ flex: 1 }}>
          <span className={`full ${variant}`}>{'█'.repeat(full)}</span>
          <span className="empty">{'░'.repeat(empty)}</span>
        </span>
        <span className="c3" style={{ fontSize: 10 }}>{pct}%</span>
      </div>
    </div>
  );
}
