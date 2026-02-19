/**
 * Design System Progress Bar component.
 */

import './ui.scss';

type ProgressSize = 'sm' | 'md' | 'lg';
type ProgressColor = 'primary' | 'success' | 'warning' | 'error';

interface ProgressProps {
  value: number;
  max?: number;
  size?: ProgressSize;
  color?: ProgressColor;
  showLabel?: boolean;
  className?: string;
}

export function Progress({
  value,
  max = 100,
  size = 'md',
  color = 'primary',
  showLabel = false,
  className = '',
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const fillClass = color === 'primary' ? '' : `ui-progress__fill--${color}`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
      <div className={`ui-progress ${size !== 'md' ? `ui-progress--${size}` : ''} ${className}`}>
        <div
          className={`ui-progress__fill ${fillClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}
