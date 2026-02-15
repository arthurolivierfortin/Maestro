/**
 * Phase 23: Loading, Error, and Empty state display components.
 * Use existing ui.scss classes (ui-skeleton, ui-empty).
 */

import type { ReactNode } from 'react';
import './ui.scss';

// ============= Loading State =============

interface LoadingStateProps {
  message?: string;
  lines?: number;
  variant?: 'skeleton' | 'spinner';
}

export function LoadingState({ message = 'Loading...', lines = 3, variant = 'skeleton' }: LoadingStateProps) {
  if (variant === 'spinner') {
    return (
      <div className="ui-empty">
        <div className="ui-empty__icon" style={{ animation: 'pulse 1s ease-in-out infinite' }}>&#9881;</div>
        <p className="ui-empty__message">{message}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="ui-skeleton ui-skeleton--text"
          style={{ width: `${100 - i * 15}%` }}
        />
      ))}
      <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-sm)' }}>
        {message}
      </p>
    </div>
  );
}

// ============= Error State =============

interface ErrorStateProps {
  message?: string;
  detail?: string;
  onRetry?: () => void;
  onAction?: () => void;
  actionLabel?: string;
}

export function ErrorState({
  message = 'Something went wrong',
  detail,
  onRetry,
  onAction,
  actionLabel,
}: ErrorStateProps) {
  return (
    <div className="ui-empty">
      <div className="ui-empty__icon">&#9888;</div>
      <h3 className="ui-empty__title" style={{ color: 'var(--color-error)' }}>{message}</h3>
      {detail && <p className="ui-empty__message">{detail}</p>}
      <div className="ui-empty__action" style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ui-btn ui-btn--primary"
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            Retry
          </button>
        )}
        {onAction && actionLabel && (
          <button
            onClick={onAction}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--background-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ============= Empty State =============

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export function EmptyState({ icon, title, message, onAction, actionLabel }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      {icon && <div className="ui-empty__icon">{icon}</div>}
      <h3 className="ui-empty__title">{title}</h3>
      {message && <p className="ui-empty__message">{message}</p>}
      {onAction && actionLabel && (
        <div className="ui-empty__action">
          <button
            onClick={onAction}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
