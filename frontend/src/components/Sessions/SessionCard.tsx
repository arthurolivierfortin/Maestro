/**
 * Session Card Component
 *
 * Displays a single session with status and actions.
 */

import React from 'react';
import type { SessionSummary } from '../../types/session.types';
import './SessionCard.scss';

interface SessionCardProps {
  session: SessionSummary;
  categoryName: string;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  categoryName,
  onStart,
  onStop,
  onDelete,
}) => {
  const isRunning = session.status === 'running';

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`session-card ${isRunning ? 'session-card--running' : ''}`}>
      <div className="session-card__header">
        <div className="session-card__status">
          <span className={`session-card__status-dot ${isRunning ? 'running' : 'stopped'}`} />
          <span className="session-card__status-text">
            {isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>
        <span className="session-card__mode">{session.mode}</span>
      </div>

      <div className="session-card__body">
        <h3 className="session-card__name">{session.name}</h3>
        <div className="session-card__meta">
          <span className="session-card__category">{categoryName}</span>
          <span className="session-card__image">{session.sandboxImageId}</span>
        </div>
      </div>

      <div className="session-card__footer">
        <span className="session-card__date">
          {isRunning ? `Started ${formatDate(session.startedAt)}` : `Last run ${formatDate(session.completedAt)}`}
        </span>

        <div className="session-card__actions">
          {isRunning ? (
            <button
              className="session-card__action session-card__action--stop"
              onClick={onStop}
              title="Stop session"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <rect x="3" y="3" width="10" height="10" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              className="session-card__action session-card__action--start"
              onClick={onStart}
              title="Start session"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M4 2.5v11l9-5.5-9-5.5z" />
              </svg>
            </button>
          )}
          <button
            className="session-card__action session-card__action--delete"
            onClick={onDelete}
            title="Delete session"
            disabled={isRunning}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M5.5 1a.5.5 0 0 0-.5.5v1h-3a.5.5 0 0 0 0 1h.5l.5 10.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L13.5 3.5h.5a.5.5 0 0 0 0-1h-3v-1a.5.5 0 0 0-.5-.5h-5zm1 2h3v-1h-3v1z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
