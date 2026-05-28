import { useState } from 'react';
import { useSessions } from '../hooks/useSessions';
import { useWorkspaces } from '../hooks/useWorkspaces';
import type { SessionDto } from '../services/sessionService';
import type { WorkspaceDto } from '../services/workspaceService';

type SpacesTab = 'sessions' | 'workspaces';

const statusClass = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'active':
    case 'running':
      return 'cok';
    case 'failed':
    case 'error':
      return 'cerr';
    case 'created':
    case 'pending':
    case 'paused':
      return 'ca';
    default:
      return 'c3';
  }
};

function StatusPip({ status }: { status: string }) {
  return (
    <span
      className={statusClass(status)}
      style={{ width: 8, height: 8, display: 'inline-block', background: 'currentColor', flexShrink: 0 }}
    />
  );
}

function SessionRow({
  session,
  onStart,
  onStop,
}: {
  session: SessionDto;
  onStart: () => void;
  onStop: () => void;
}) {
  const isActive = session.status.toLowerCase() === 'active';
  const canStart = ['created', 'stopped'].includes(session.status.toLowerCase());
  const canStop = isActive;

  const formatDuration = (ms?: number): string => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="row gap-12" style={{ padding: '6px 14px', borderBottom: '1px dotted var(--line-soft)' }}>
      <StatusPip status={session.status} />
      <div className="flex-1">
        <div className="c0 bd" style={{ fontSize: 13 }}>{session.name}</div>
        <div className="c2" style={{ fontSize: 11, marginTop: 2 }}>
          {session.type} | {session.status} | {formatDuration(session.durationMs)}
        </div>
      </div>
      <div className="row gap-6">
        {canStart && (
          <button onClick={onStart} className="b ok" style={{ cursor: 'pointer' }}>
            Start
          </button>
        )}
        {canStop && (
          <button onClick={onStop} className="b err" style={{ cursor: 'pointer' }}>
            Stop
          </button>
        )}
      </div>
    </div>
  );
}

function WorkspaceRow({ workspace }: { workspace: WorkspaceDto }) {
  return (
    <div className="row gap-12" style={{ padding: '6px 14px', borderBottom: '1px dotted var(--line-soft)' }}>
      <StatusPip status={workspace.status} />
      <div className="flex-1">
        <div className="c0 bd" style={{ fontSize: 13 }}>{workspace.name}</div>
        <div className="c2" style={{ fontSize: 11, marginTop: 2 }}>
          {workspace.type} | {workspace.status} | {workspace.sessionIds.length} sessions
        </div>
      </div>
    </div>
  );
}

export function SpacesPage() {
  const [activeTab, setActiveTab] = useState<SpacesTab>('sessions');
  const { sessions, isLoading: sessionsLoading, error: sessionsError, startSession, stopSession } = useSessions();
  const { workspaces, isLoading: workspacesLoading, error: workspacesError } = useWorkspaces();

  const isLoading = activeTab === 'sessions' ? sessionsLoading : workspacesLoading;
  const error = activeTab === 'sessions' ? sessionsError : workspacesError;

  return (
    <div className="col" style={{ height: '100%' }}>
      {/* Sub-tabs */}
      <div className="tabs">
        <span
          className={`tab${activeTab === 'sessions' ? ' active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          Sessions
        </span>
        <span
          className={`tab${activeTab === 'workspaces' ? ' active' : ''}`}
          onClick={() => setActiveTab('workspaces')}
        >
          Workspaces
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {isLoading && (
          <div className="c2" style={{ fontSize: 13 }}>Loading {activeTab}...</div>
        )}

        {error && (
          <div className="cerr" style={{ fontSize: 13 }}>Error: {error}</div>
        )}

        {!isLoading && !error && activeTab === 'sessions' && (
          <div className="box">
            <div className="box-title">Sessions</div>
            <div className="box-meta">{sessions.length}</div>
            <div className="box-body" style={{ paddingLeft: 0, paddingRight: 0 }}>
              {sessions.length === 0 ? (
                <div className="c2" style={{ fontSize: 13, padding: '4px 14px' }}>No sessions found.</div>
              ) : (
                sessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onStart={() => startSession(session.id)}
                    onStop={() => stopSession(session.id)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {!isLoading && !error && activeTab === 'workspaces' && (
          <div className="box">
            <div className="box-title">Workspaces</div>
            <div className="box-meta">{workspaces.length}</div>
            <div className="box-body" style={{ paddingLeft: 0, paddingRight: 0 }}>
              {workspaces.length === 0 ? (
                <div className="c2" style={{ fontSize: 13, padding: '4px 14px' }}>No workspaces found.</div>
              ) : (
                workspaces.map((workspace) => (
                  <WorkspaceRow key={workspace.id} workspace={workspace} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
