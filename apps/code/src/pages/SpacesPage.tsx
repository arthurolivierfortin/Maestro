import { useState } from 'react';
import { useSessions } from '../hooks/useSessions';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { colors, spacing, fontFamily } from '../theme/tokens';
import type { SessionDto } from '../services/sessionService';
import type { WorkspaceDto } from '../services/workspaceService';

type SpacesTab = 'sessions' | 'workspaces';

const statusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'active':
    case 'running':
      return colors.success;
    case 'failed':
    case 'error':
      return colors.error;
    case 'created':
    case 'pending':
    case 'paused':
      return colors.accent;
    default:
      return colors.muted;
  }
};

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
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md,
      padding: `${spacing.sm} ${spacing.md}`,
      borderBottom: `1px solid ${colors.border}`,
      fontFamily,
    }}>
      <span style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: statusColor(session.status),
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: colors.fg, fontSize: '13px', fontWeight: 600 }}>
          {session.name}
        </div>
        <div style={{ color: colors.muted, fontSize: '11px', marginTop: '2px' }}>
          {session.type} | {session.status} | {formatDuration(session.durationMs)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: spacing.xs }}>
        {canStart && (
          <button
            onClick={onStart}
            style={{
              background: 'none',
              border: `1px solid ${colors.success}`,
              color: colors.success,
              cursor: 'pointer',
              padding: `2px ${spacing.sm}`,
              fontSize: '11px',
              fontFamily,
            }}
          >
            Start
          </button>
        )}
        {canStop && (
          <button
            onClick={onStop}
            style={{
              background: 'none',
              border: `1px solid ${colors.error}`,
              color: colors.error,
              cursor: 'pointer',
              padding: `2px ${spacing.sm}`,
              fontSize: '11px',
              fontFamily,
            }}
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}

function WorkspaceRow({ workspace }: { workspace: WorkspaceDto }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md,
      padding: `${spacing.sm} ${spacing.md}`,
      borderBottom: `1px solid ${colors.border}`,
      fontFamily,
    }}>
      <span style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: statusColor(workspace.status),
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: colors.fg, fontSize: '13px', fontWeight: 600 }}>
          {workspace.name}
        </div>
        <div style={{ color: colors.muted, fontSize: '11px', marginTop: '2px' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily }}>
      {/* Sub-tabs */}
      <div style={{
        display: 'flex',
        gap: spacing.sm,
        padding: `${spacing.sm} ${spacing.md}`,
        borderBottom: `1px solid ${colors.border}`,
      }}>
        <button
          onClick={() => setActiveTab('sessions')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'sessions' ? colors.accent : colors.muted,
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'sessions' ? 700 : 400,
            fontFamily,
            padding: `${spacing.xs} ${spacing.sm}`,
            borderBottom: activeTab === 'sessions' ? `2px solid ${colors.accent}` : '2px solid transparent',
          }}
        >
          Sessions
        </button>
        <button
          onClick={() => setActiveTab('workspaces')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'workspaces' ? colors.accent : colors.muted,
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'workspaces' ? 700 : 400,
            fontFamily,
            padding: `${spacing.xs} ${spacing.sm}`,
            borderBottom: activeTab === 'workspaces' ? `2px solid ${colors.accent}` : '2px solid transparent',
          }}
        >
          Workspaces
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && (
          <div style={{ padding: spacing.md, color: colors.muted, fontSize: '13px' }}>
            Loading {activeTab}...
          </div>
        )}

        {error && (
          <div style={{ padding: spacing.md, color: colors.error, fontSize: '13px' }}>
            Error: {error}
          </div>
        )}

        {!isLoading && !error && activeTab === 'sessions' && (
          sessions.length === 0 ? (
            <div style={{ padding: spacing.md, color: colors.muted, fontSize: '13px' }}>
              No sessions found.
            </div>
          ) : (
            sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onStart={() => startSession(session.id)}
                onStop={() => stopSession(session.id)}
              />
            ))
          )
        )}

        {!isLoading && !error && activeTab === 'workspaces' && (
          workspaces.length === 0 ? (
            <div style={{ padding: spacing.md, color: colors.muted, fontSize: '13px' }}>
              No workspaces found.
            </div>
          ) : (
            workspaces.map((workspace) => (
              <WorkspaceRow key={workspace.id} workspace={workspace} />
            ))
          )
        )}
      </div>
    </div>
  );
}
