/**
 * Sessions Page
 *
 * Generic session list page.
 * Sessions are execution units for blocks - no domain-specific UI.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { SessionStatus, SessionSummary } from '../types/session.types';
import './SessionsPage.scss';

// ============= Sub-Components =============

interface SessionRowProps {
  session: SessionSummary;
  onView: () => void;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onRetry: () => void;
  onDelete: () => void;
}

const SessionRow: React.FC<SessionRowProps> = ({
  session,
  onView,
  onStart,
  onPause,
  onStop,
  onRetry,
  onDelete,
}) => {
  const statusIcon: Record<SessionStatus, string> = {
    Running: '🟢',
    Pending: '⏳',
    Paused: '🟡',
    Completed: '✅',
    Failed: '❌',
    Cancelled: '⚫'
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const progress = session.blocksTotal > 0
    ? Math.round((session.blocksCompleted / session.blocksTotal) * 100)
    : 0;

  return (
    <div className="session-row">
      <div className="session-row__icon">
        {statusIcon[session.status] || '⚪'}
      </div>

      <div className="session-row__content" onClick={onView}>
        <div className="session-row__header">
          <span className="session-row__id">{session.id}</span>
          <span className="session-row__status">{session.status}</span>
        </div>

        <div className="session-row__meta">
          <span className="session-row__workspace">
            Workspace: {session.workspaceName}
          </span>
          {session.status === 'Running' && session.currentBlockName && (
            <span className="session-row__current">
              Current: {session.currentBlockName}
            </span>
          )}
          {session.duration && (
            <span className="session-row__duration">
              Duration: {formatDuration(session.duration)}
            </span>
          )}
        </div>

        {/* Progress bar for running/completed sessions */}
        {(session.status === 'Running' || session.blocksCompleted > 0) && (
          <div className="session-row__progress">
            <div className="session-row__progress-bar">
              <div
                className="session-row__progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="session-row__progress-text">
              {session.blocksCompleted}/{session.blocksTotal} blocks ({progress}%)
            </span>
          </div>
        )}

        {/* Error message for failed sessions */}
        {session.status === 'Failed' && session.error && (
          <div className="session-row__error">
            Error: {session.error}
          </div>
        )}
      </div>

      <div className="session-row__actions">
        <button className="btn btn-primary btn-sm" onClick={onView}>
          View
        </button>
        {session.status === 'Pending' && (
          <button className="btn btn-secondary btn-sm" onClick={onStart} title="Start">
            ▶️
          </button>
        )}
        {session.status === 'Running' && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={onPause} title="Pause">
              ⏸️
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onStop} title="Stop">
              ⏹️
            </button>
          </>
        )}
        {session.status === 'Paused' && (
          <button className="btn btn-secondary btn-sm" onClick={onStart} title="Resume">
            ▶️
          </button>
        )}
        {session.status === 'Failed' && (
          <button className="btn btn-secondary btn-sm" onClick={onRetry} title="Retry">
            🔄
          </button>
        )}
        {(session.status === 'Completed' || session.status === 'Failed' || session.status === 'Cancelled') && (
          <button className="btn btn-danger btn-sm" onClick={onDelete} title="Delete">
            🗑️
          </button>
        )}
      </div>
    </div>
  );
};

// Session Detail Modal
interface SessionDetailModalProps {
  sessionId: string;
  onClose: () => void;
}

const SessionDetailModal: React.FC<SessionDetailModalProps> = ({ sessionId, onClose }) => {
  const { selectedSession, loadSession, stopSession } = useSessionStore();

  useEffect(() => {
    loadSession(sessionId);
  }, [sessionId, loadSession]);

  if (!selectedSession) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content modal-content--large" onClick={e => e.stopPropagation()}>
          <div className="modal-loading">Loading session details...</div>
        </div>
      </div>
    );
  }

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString();
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Session Details</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="session-detail">
          <div className="session-detail__header">
            <div className="session-detail__id">
              <code>{selectedSession.id}</code>
            </div>
            <div className="session-detail__status">
              {selectedSession.status === 'Running' && '🟢'}
              {selectedSession.status === 'Pending' && '⏳'}
              {selectedSession.status === 'Completed' && '✅'}
              {selectedSession.status === 'Failed' && '❌'}
              {selectedSession.status === 'Paused' && '🟡'}
              {selectedSession.status === 'Cancelled' && '⚫'}
              {' '}{selectedSession.status}
            </div>
          </div>

          {/* Progress */}
          <div className="session-detail__section">
            <h3>Progress</h3>
            <div className="session-detail__progress">
              <div className="session-detail__progress-bar">
                <div
                  className="session-detail__progress-fill"
                  style={{
                    width: `${selectedSession.blocksTotal > 0
                      ? (selectedSession.blocksCompleted / selectedSession.blocksTotal) * 100
                      : 0}%`
                  }}
                />
              </div>
              <span>
                {selectedSession.blocksCompleted} / {selectedSession.blocksTotal} blocks
              </span>
            </div>
            {selectedSession.currentBlockName && (
              <p>Current block: <strong>{selectedSession.currentBlockName}</strong></p>
            )}
          </div>

          {/* Timing */}
          <div className="session-detail__section">
            <h3>Timing</h3>
            <dl className="session-detail__info">
              <dt>Created</dt>
              <dd>{formatTimestamp(selectedSession.createdAt)}</dd>
              <dt>Started</dt>
              <dd>{formatTimestamp(selectedSession.startedAt)}</dd>
              <dt>Completed</dt>
              <dd>{formatTimestamp(selectedSession.completedAt)}</dd>
              <dt>Duration</dt>
              <dd>{formatDuration(selectedSession.duration)}</dd>
            </dl>
          </div>

          {/* Executions */}
          {selectedSession.executions.length > 0 && (
            <div className="session-detail__section">
              <h3>Block Executions</h3>
              <div className="session-detail__executions">
                {selectedSession.executions.map((exec, idx) => (
                  <div key={idx} className={`execution-item execution-item--${exec.status}`}>
                    <div className="execution-item__status">
                      {exec.status === 'completed' && '✅'}
                      {exec.status === 'running' && '🔄'}
                      {exec.status === 'pending' && '⏳'}
                      {exec.status === 'failed' && '❌'}
                      {exec.status === 'skipped' && '⏭️'}
                    </div>
                    <div className="execution-item__content">
                      <div className="execution-item__name">{exec.blockName}</div>
                      <div className="execution-item__meta">
                        <span>Type: {exec.blockType}</span>
                        {exec.duration && <span>Duration: {formatDuration(exec.duration)}</span>}
                        {exec.retryCount > 0 && <span>Retries: {exec.retryCount}</span>}
                      </div>
                      {exec.error && (
                        <div className="execution-item__error">{exec.error}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {selectedSession.error && (
            <div className="session-detail__section session-detail__section--error">
              <h3>Error</h3>
              <div className="session-detail__error">{selectedSession.error}</div>
            </div>
          )}

          {/* Recent Logs */}
          {selectedSession.recentLogs.length > 0 && (
            <div className="session-detail__section">
              <h3>Recent Logs</h3>
              <div className="session-detail__logs">
                {selectedSession.recentLogs.map((log, idx) => (
                  <div key={idx} className={`log-item log-item--${log.level}`}>
                    <span className="log-item__time">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="log-item__level">[{log.level.toUpperCase()}]</span>
                    <span className="log-item__message">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          {selectedSession.status === 'Running' && (
            <button
              className="btn btn-danger"
              onClick={() => stopSession(selectedSession.id)}
            >
              Stop Session
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Empty State
const EmptyState: React.FC = () => (
  <div className="sessions-empty">
    <div className="sessions-empty__icon">🔄</div>
    <h3>No sessions found</h3>
    <p>Sessions are created when workflows are executed in workspaces</p>
  </div>
);

// ============= Main Component =============

type FilterStatus = SessionStatus | 'All';

const STATUS_FILTERS: { status: FilterStatus; label: string }[] = [
  { status: 'All', label: 'All' },
  { status: 'Running', label: 'Running' },
  { status: 'Pending', label: 'Pending' },
  { status: 'Completed', label: 'Completed' },
  { status: 'Failed', label: 'Failed' },
];

export function SessionsPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const {
    sessions,
    isLoading,
    error,
    statusFilter,
    workspaceFilter,
    searchQuery,
    loadSessions,
    startSession,
    pauseSession,
    stopSession,
    retrySession,
    deleteSession,
    setStatusFilter,
    setWorkspaceFilter,
    setSearchQuery,
    filteredSessions,
    countByStatus,
  } = useSessionStore();

  const { workspaces, loadWorkspaces } = useWorkspaceStore();

  useEffect(() => {
    loadSessions();
    loadWorkspaces();
  }, [loadSessions, loadWorkspaces]);

  const filtered = useMemo(() => filteredSessions(), [sessions, statusFilter, workspaceFilter, searchQuery]);
  const counts = useMemo(() => countByStatus(), [sessions]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this session?')) {
      await deleteSession(id);
    }
  };

  return (
    <div className="sessions-page">
      {/* Header */}
      <header className="sessions-page__header">
        <div className="sessions-page__title">
          <h1>Sessions</h1>
          <div className="sessions-page__count">
            <span className="sessions-page__count-running">{counts.Running} running</span>
            <span className="sessions-page__count-total">{counts.All} total</span>
          </div>
        </div>

        <div className="sessions-page__actions">
          <div className="sessions-page__search">
            <span className="sessions-page__search-icon">🔍</span>
            <input
              type="text"
              className="sessions-page__search-input"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="sessions-page__filters">
        {STATUS_FILTERS.map(({ status, label }) => (
          <button
            key={status}
            className={`sessions-page__filter ${statusFilter === status ? 'active' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {label}
            <span className="sessions-page__filter-count">{counts[status] || 0}</span>
          </button>
        ))}
      </div>

      {/* Workspace filter */}
      <div className="sessions-page__workspace-filter">
        <label>Workspace:</label>
        <select
          value={workspaceFilter || ''}
          onChange={(e) => setWorkspaceFilter(e.target.value || null)}
        >
          <option value="">All Workspaces</option>
          {workspaces.map(ws => (
            <option key={ws.id} value={ws.id}>{ws.name}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="sessions-page__error">
          <span>Error: {error}</span>
        </div>
      )}

      {/* Content */}
      <div className="sessions-page__content">
        {isLoading ? (
          <div className="sessions-loading">Loading sessions...</div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="sessions-list">
            {filtered.map(session => (
              <SessionRow
                key={session.id}
                session={session}
                onView={() => setSelectedSessionId(session.id)}
                onStart={() => startSession(session.id)}
                onPause={() => pauseSession(session.id)}
                onStop={() => stopSession(session.id)}
                onRetry={() => retrySession(session.id)}
                onDelete={() => handleDelete(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Session Detail Modal */}
      {selectedSessionId && (
        <SessionDetailModal
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
}

export default SessionsPage;
