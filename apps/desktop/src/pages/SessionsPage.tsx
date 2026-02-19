/**
 * Sessions Page
 *
 * Generic session list page.
 * Sessions are execution units for blocks - no domain-specific UI.
 */

import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/sessionStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { Badge, StatusIndicator, LoadingState, ErrorState, EmptyState } from '@components/ui';
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

const statusToIndicator = (status: SessionStatus) => {
  const map: Record<SessionStatus, 'running' | 'success' | 'error' | 'warning' | 'pending'> = {
    Running: 'running', Completed: 'success', Failed: 'error',
    Paused: 'warning', Pending: 'pending', Cancelled: 'pending',
  };
  return map[status] || 'pending';
};

const statusToVariant = (status: SessionStatus) => {
  const map: Record<SessionStatus, 'info' | 'success' | 'error' | 'warning' | 'muted'> = {
    Running: 'info', Completed: 'success', Failed: 'error',
    Paused: 'warning', Pending: 'muted', Cancelled: 'muted',
  };
  return map[status] || 'muted';
};

const SessionRow: React.FC<SessionRowProps> = ({
  session,
  onView,
  onStart,
  onPause,
  onStop,
  onRetry,
  onDelete,
}) => {
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
        <StatusIndicator
          status={statusToIndicator(session.status)}
          size="md"
          pulse={session.status === 'Running'}
        />
      </div>

      <div className="session-row__content" onClick={onView}>
        <div className="session-row__header">
          <span className="session-row__id">{session.id.substring(0, 12)}</span>
          <Badge variant={statusToVariant(session.status)} size="sm">{session.status}</Badge>
        </div>

        <div className="session-row__meta">
          <span className="session-row__workspace">
            {session.workspaceName}
          </span>
          {session.status === 'Running' && session.currentBlockName && (
            <span className="session-row__current">
              {session.currentBlockName}
            </span>
          )}
          {session.duration != null && (
            <span className="session-row__duration">
              {formatDuration(session.duration)}
            </span>
          )}
        </div>

        {(session.status === 'Running' || session.blocksCompleted > 0) && (
          <div className="session-row__progress">
            <div className="session-row__progress-bar">
              <div
                className="session-row__progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="session-row__progress-text">
              {session.blocksCompleted}/{session.blocksTotal} ({progress}%)
            </span>
          </div>
        )}

        {session.status === 'Failed' && session.error && (
          <div className="session-row__error">
            {session.error}
          </div>
        )}
      </div>

      <div className="session-row__actions">
        <button className="btn btn-primary btn-sm" onClick={onView}>
          View
        </button>
        {session.status === 'Pending' && (
          <button className="btn btn-secondary btn-sm" onClick={onStart} title="Start">
            &#9654;
          </button>
        )}
        {session.status === 'Running' && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={onPause} title="Pause">
              &#9208;
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onStop} title="Stop">
              &#9209;
            </button>
          </>
        )}
        {session.status === 'Paused' && (
          <button className="btn btn-secondary btn-sm" onClick={onStart} title="Resume">
            &#9654;
          </button>
        )}
        {session.status === 'Failed' && (
          <button className="btn btn-secondary btn-sm" onClick={onRetry} title="Retry">
            &#8635;
          </button>
        )}
        {(session.status === 'Completed' || session.status === 'Failed' || session.status === 'Cancelled') && (
          <button className="btn btn-danger btn-sm" onClick={onDelete} title="Delete">
            &#128465;
          </button>
        )}
      </div>
    </div>
  );
};

// SessionDetailModal removed — now using /sessions/:id route

// (EmptyState imported from @components/ui)

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
  const navigate = useNavigate();

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
    <div className="sessions-page page-enter">
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
          <ErrorState message="Failed to load sessions" detail={error} onRetry={loadSessions} />
        </div>
      )}

      {/* Content */}
      <div className="sessions-page__content">
        {isLoading ? (
          <LoadingState message="Loading sessions..." lines={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No sessions found"
            message="Sessions are created when workflows are executed in workspaces."
          />
        ) : (
          <div className="sessions-list stagger-children">
            {filtered.map(session => (
              <SessionRow
                key={session.id}
                session={session}
                onView={() => navigate(`/sessions/${session.id}`)}
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
    </div>
  );
}

export default SessionsPage;
