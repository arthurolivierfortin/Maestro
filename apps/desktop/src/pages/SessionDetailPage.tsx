/**
 * Session Detail Page — Full session view with phases, execution tree, logs, artifacts, metrics.
 * Route: /sessions/:id
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Badge, StatusIndicator, Button, Tabs, Progress, LoadingState, ErrorState } from '@components/ui';
import type { Session, BlockExecution, SessionLog } from '../types/session.types';
import './SessionDetailPage.scss';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ============= Helpers =============

const formatDuration = (ms?: number) => {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const formatTime = (ts?: string) => {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
};

const statusColor = (status: string) => {
  const map: Record<string, 'success' | 'info' | 'warning' | 'error' | 'muted'> = {
    Running: 'info', Completed: 'success', Failed: 'error',
    Paused: 'warning', Pending: 'muted', Cancelled: 'muted',
    completed: 'success', running: 'info', failed: 'error',
    pending: 'muted', skipped: 'muted',
  };
  return map[status] || 'muted';
};

// ============= Sub-Components =============

function PhasesStepper({ phases }: { phases: Array<{ id: string; name: string; status: string }> }) {
  if (!phases || phases.length === 0) return null;

  return (
    <div className="ui-stepper">
      {phases.map((phase, i) => {
        const stepClass = phase.status === 'completed' ? 'completed'
          : phase.status === 'active' || phase.status === 'running' ? 'active'
          : phase.status === 'failed' || phase.status === 'error' ? 'failed'
          : 'pending';

        return (
          <div key={phase.id} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <div className={`ui-stepper__connector ${stepClass === 'completed' ? 'ui-stepper__connector--completed' : ''}`} />
            )}
            <div className={`ui-stepper__step ui-stepper__step--${stepClass}`}>
              <span className="ui-stepper__icon">
                {stepClass === 'completed' ? '\u2713' : stepClass === 'failed' ? '!' : i + 1}
              </span>
              <span>{phase.name}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExecutionTree({ executions }: { executions: BlockExecution[] }) {
  if (!executions || executions.length === 0) {
    return (
      <div style={{ padding: 'var(--spacing-lg)', color: 'var(--text-tertiary)', textAlign: 'center' }}>
        No block executions yet.
      </div>
    );
  }

  return (
    <div className="exec-tree">
      {executions.map((exec, idx) => (
        <div key={idx} className={`exec-tree__node exec-tree__node--${exec.status}`}>
          <div className="exec-tree__status">
            <StatusIndicator
              status={exec.status === 'completed' ? 'success'
                : exec.status === 'running' ? 'running'
                : exec.status === 'failed' ? 'error'
                : 'pending'}
              size="sm"
              pulse={exec.status === 'running'}
            />
          </div>
          <div className="exec-tree__content">
            <div className="exec-tree__name">{exec.blockName}</div>
            <div className="exec-tree__meta">
              <Badge variant="muted" size="sm">{exec.blockType}</Badge>
              {exec.duration != null && (
                <span className="exec-tree__duration">{formatDuration(exec.duration)}</span>
              )}
              {exec.retryCount > 0 && (
                <span className="exec-tree__retry">Retries: {exec.retryCount}</span>
              )}
            </div>
            {exec.error && (
              <div className="exec-tree__error">{exec.error}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LogsPanel({ logs }: { logs: SessionLog[] }) {
  if (!logs || logs.length === 0) {
    return (
      <div style={{ padding: 'var(--spacing-lg)', color: 'var(--text-tertiary)', textAlign: 'center' }}>
        No logs available.
      </div>
    );
  }

  return (
    <div className="logs-panel">
      {logs.map((log, idx) => (
        <div key={idx} className={`logs-panel__entry logs-panel__entry--${log.level}`}>
          <span className="logs-panel__time">{new Date(log.timestamp).toLocaleTimeString()}</span>
          <span className="logs-panel__level">[{log.level.toUpperCase()}]</span>
          <span className="logs-panel__msg">{log.message}</span>
        </div>
      ))}
    </div>
  );
}

function MetricsPanel({ session }: { session: Session }) {
  const progress = session.blocksTotal > 0
    ? (session.blocksCompleted / session.blocksTotal) * 100
    : 0;

  return (
    <div className="metrics-grid stagger-children">
      <Card variant="default" padding="md">
        <div className="metric-card">
          <span className="metric-card__value">{session.blocksCompleted}/{session.blocksTotal}</span>
          <span className="metric-card__label">Blocks Completed</span>
          <Progress value={progress} size="sm" color={progress >= 100 ? 'success' : 'primary'} />
        </div>
      </Card>
      <Card variant="default" padding="md">
        <div className="metric-card">
          <span className="metric-card__value">{formatDuration(session.duration)}</span>
          <span className="metric-card__label">Duration</span>
        </div>
      </Card>
      <Card variant="default" padding="md">
        <div className="metric-card">
          <span className="metric-card__value">
            {session.executions.filter(e => e.status === 'failed').length}
          </span>
          <span className="metric-card__label">Failed Blocks</span>
        </div>
      </Card>
      <Card variant="default" padding="md">
        <div className="metric-card">
          <span className="metric-card__value">
            {session.executions.reduce((sum, e) => sum + e.retryCount, 0)}
          </span>
          <span className="metric-card__label">Total Retries</span>
        </div>
      </Card>
    </div>
  );
}

// ============= Main Component =============

type DetailTab = 'overview' | 'execution' | 'logs' | 'metrics';

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [variables, setVariables] = useState<Record<string, unknown> | null>(null);

  const fetchSession = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/api/sessions/${id}`);
      if (!res.ok) throw new Error(`Session not found (${res.status})`);
      const data = await res.json();
      setSession(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchVariables = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/api/sessions/${id}/variables`);
      if (res.ok) {
        setVariables(await res.json());
      }
    } catch {
      // Variables are optional
    }
  }, [id]);

  useEffect(() => {
    fetchSession();
    fetchVariables();
  }, [fetchSession, fetchVariables]);

  // Auto-refresh for active sessions
  useEffect(() => {
    if (!session || (session.status !== 'Running' && session.status !== 'Pending')) return;
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [session?.status, fetchSession]);

  const phases = useMemo(() => {
    if (!variables || !variables['_phases']) return [];
    const raw = variables['_phases'];
    if (!Array.isArray(raw)) return [];
    return raw.map((p: any) => ({
      id: p.id || p.name || String(Math.random()),
      name: p.name || p.id || 'Phase',
      status: p.status || 'pending',
    }));
  }, [variables]);

  const handleAction = async (action: string) => {
    if (!id) return;
    try {
      await fetch(`${API_URL}/api/sessions/${id}/${action}`, { method: 'POST' });
      await fetchSession();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const tabs = useMemo(() => [
    { id: 'overview', label: 'Overview' },
    { id: 'execution', label: 'Execution', count: session?.executions.length },
    { id: 'logs', label: 'Logs', count: session?.recentLogs.length },
    { id: 'metrics', label: 'Metrics' },
  ], [session]);

  if (loading) {
    return (
      <div className="session-detail-page page-enter">
        <LoadingState message="Loading session..." lines={5} />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="session-detail-page page-enter">
        <ErrorState
          message="Session not found"
          detail={error || `Session ${id} could not be loaded`}
          onRetry={fetchSession}
          onAction={() => navigate('/sessions')}
          actionLabel="Back to Sessions"
        />
      </div>
    );
  }

  const progress = session.blocksTotal > 0
    ? Math.round((session.blocksCompleted / session.blocksTotal) * 100)
    : 0;

  return (
    <div className="session-detail-page page-enter">
      {/* Header */}
      <header className="sdp-header">
        <div className="sdp-header__left">
          <Link to="/sessions" className="sdp-header__back">&larr; Sessions</Link>
          <h1 className="sdp-header__title">
            {session.id.substring(0, 8)}
            <Badge variant={statusColor(session.status)} size="md">{session.status}</Badge>
          </h1>
          <p className="sdp-header__subtitle">
            Workspace: {session.workspaceName}
            {session.currentBlockName && (
              <> &middot; Current: <strong>{session.currentBlockName}</strong></>
            )}
          </p>
        </div>
        <div className="sdp-header__actions">
          {session.status === 'Pending' && (
            <Button variant="primary" size="md" onClick={() => handleAction('start')}>
              Start
            </Button>
          )}
          {session.status === 'Running' && (
            <>
              <Button variant="secondary" size="md" onClick={() => handleAction('pause')}>
                Pause
              </Button>
              <Button variant="danger" size="md" onClick={() => handleAction('stop')}>
                Stop
              </Button>
            </>
          )}
          {session.status === 'Paused' && (
            <Button variant="primary" size="md" onClick={() => handleAction('resume')}>
              Resume
            </Button>
          )}
          {session.status === 'Failed' && (
            <Button variant="primary" size="md" onClick={() => handleAction('retry')}>
              Retry
            </Button>
          )}
        </div>
      </header>

      {/* Progress */}
      <div className="sdp-progress">
        <div className="sdp-progress__bar">
          <Progress value={progress} color={session.status === 'Failed' ? 'error' : progress >= 100 ? 'success' : 'primary'} />
        </div>
        <span className="sdp-progress__label">
          {session.blocksCompleted}/{session.blocksTotal} blocks ({progress}%)
        </span>
      </div>

      {/* Phases Stepper (if session has phases) */}
      {phases.length > 0 && (
        <section className="sdp-phases">
          <PhasesStepper phases={phases} />
        </section>
      )}

      {/* Error Banner */}
      {session.error && (
        <div className="sdp-error-banner">
          <strong>Error:</strong> {session.error}
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as DetailTab)}
      />

      {/* Tab Content */}
      <div className="sdp-content">
        {activeTab === 'overview' && (
          <div className="sdp-overview stagger-children">
            <div className="sdp-overview__grid">
              <Card variant="default" padding="md">
                <h3 className="sdp-section-title">Session Info</h3>
                <div className="ui-kv">
                  <span className="ui-kv__key">ID</span>
                  <code className="ui-kv__value ui-kv__value--mono">{session.id}</code>
                  <span className="ui-kv__key">Status</span>
                  <span className="ui-kv__value">{session.status}</span>
                  <span className="ui-kv__key">Workspace</span>
                  <span className="ui-kv__value">{session.workspaceName}</span>
                  <span className="ui-kv__key">Created</span>
                  <span className="ui-kv__value">{formatTime(session.createdAt)}</span>
                  <span className="ui-kv__key">Started</span>
                  <span className="ui-kv__value">{formatTime(session.startedAt)}</span>
                  <span className="ui-kv__key">Duration</span>
                  <span className="ui-kv__value">{formatDuration(session.duration)}</span>
                </div>
              </Card>

              <Card variant="default" padding="md">
                <h3 className="sdp-section-title">Quick Metrics</h3>
                <MetricsPanel session={session} />
              </Card>
            </div>

            {/* Recent executions preview */}
            {session.executions.length > 0 && (
              <Card variant="default" padding="md">
                <div className="ui-section__header">
                  <h3 className="sdp-section-title">Recent Executions</h3>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('execution')}>
                    View all
                  </Button>
                </div>
                <ExecutionTree executions={session.executions.slice(0, 5)} />
              </Card>
            )}
          </div>
        )}

        {activeTab === 'execution' && (
          <Card variant="default" padding="md">
            <ExecutionTree executions={session.executions} />
          </Card>
        )}

        {activeTab === 'logs' && (
          <Card variant="default" padding="none">
            <LogsPanel logs={session.recentLogs} />
          </Card>
        )}

        {activeTab === 'metrics' && (
          <MetricsPanel session={session} />
        )}
      </div>
    </div>
  );
}

export default SessionDetailPage;
