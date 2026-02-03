/**
 * Workspace Detail Page
 *
 * Generic workspace detail view with UI block slot.
 * Shows generic overview + custom UI panels defined by workspace.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useSessionStore } from '../store/sessionStore';
import { UIBlockRenderer } from '../components/ui-block';
import './WorkspaceDetailPage.scss';

// ============= Tab Types =============

type TabId = 'overview' | 'blocks' | 'sessions' | 'logs' | string;

interface Tab {
  id: TabId;
  label: string;
  icon: string;
  isUIBlock?: boolean;
  blockId?: string;
}

// ============= Sub-Components =============

interface OverviewPanelProps {
  workspace: {
    id: string;
    name: string;
    description?: string;
    type: string;
    status: string;
    sessionIds: string[];
    projectIds: string[];
    settings: { tags: string[] };
    createdAt: string;
    updatedAt: string;
  };
}

const OverviewPanel: React.FC<OverviewPanelProps> = ({ workspace }) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="overview-panel">
      <h2>Overview</h2>

      <div className="overview-panel__grid">
        <div className="overview-panel__card">
          <div className="overview-panel__card-label">Status</div>
          <div className="overview-panel__card-value">
            {workspace.status === 'Active' && '🟢'}
            {workspace.status === 'Paused' && '🟡'}
            {workspace.status === 'Archived' && '🔵'}
            {' '}{workspace.status}
          </div>
        </div>

        <div className="overview-panel__card">
          <div className="overview-panel__card-label">Type</div>
          <div className="overview-panel__card-value">{workspace.type}</div>
        </div>

        <div className="overview-panel__card">
          <div className="overview-panel__card-label">Sessions</div>
          <div className="overview-panel__card-value">{workspace.sessionIds.length}</div>
        </div>

        <div className="overview-panel__card">
          <div className="overview-panel__card-label">Projects</div>
          <div className="overview-panel__card-value">{workspace.projectIds.length}</div>
        </div>
      </div>

      {workspace.description && (
        <div className="overview-panel__section">
          <h3>Description</h3>
          <p>{workspace.description}</p>
        </div>
      )}

      <div className="overview-panel__section">
        <h3>Details</h3>
        <dl className="overview-panel__details">
          <dt>Created</dt>
          <dd>{formatDate(workspace.createdAt)}</dd>
          <dt>Last Updated</dt>
          <dd>{formatDate(workspace.updatedAt)}</dd>
          <dt>Workspace ID</dt>
          <dd><code>{workspace.id}</code></dd>
        </dl>
      </div>

      {workspace.settings.tags.length > 0 && (
        <div className="overview-panel__section">
          <h3>Tags</h3>
          <div className="overview-panel__tags">
            {workspace.settings.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface SessionsPanelProps {
  workspaceId: string;
}

const SessionsPanel: React.FC<SessionsPanelProps> = ({ workspaceId }) => {
  const { sessions, isLoading, loadSessions } = useSessionStore();

  useEffect(() => {
    loadSessions({ workspaceId });
  }, [workspaceId, loadSessions]);

  const workspaceSessions = useMemo(() =>
    sessions.filter(s => s.workspaceId === workspaceId),
    [sessions, workspaceId]
  );

  if (isLoading) {
    return <div className="panel-loading">Loading sessions...</div>;
  }

  if (workspaceSessions.length === 0) {
    return (
      <div className="panel-empty">
        <div className="panel-empty__icon">🔄</div>
        <p>No sessions in this workspace yet</p>
      </div>
    );
  }

  return (
    <div className="sessions-panel">
      <h2>Sessions ({workspaceSessions.length})</h2>
      <div className="sessions-panel__list">
        {workspaceSessions.map(session => (
          <div key={session.id} className="session-item">
            <div className="session-item__status">
              {session.status === 'Running' && '🟢'}
              {session.status === 'Pending' && '⏳'}
              {session.status === 'Completed' && '✅'}
              {session.status === 'Failed' && '❌'}
              {session.status === 'Paused' && '🟡'}
              {session.status === 'Cancelled' && '⚫'}
            </div>
            <div className="session-item__content">
              <div className="session-item__id">{session.id}</div>
              <div className="session-item__meta">
                <span>Status: {session.status}</span>
                {session.blocksCompleted !== undefined && (
                  <span>Progress: {session.blocksCompleted}/{session.blocksTotal}</span>
                )}
                {session.currentBlockName && (
                  <span>Current: {session.currentBlockName}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BlocksPanel: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  // TODO: Implement blocks listing for workspace
  return (
    <div className="blocks-panel">
      <h2>Blocks</h2>
      <div className="panel-empty">
        <div className="panel-empty__icon">🧱</div>
        <p>Block listing coming soon</p>
        <p className="panel-empty__hint">Workspace ID: {workspaceId}</p>
      </div>
    </div>
  );
};

const LogsPanel: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  // TODO: Implement workspace logs
  return (
    <div className="logs-panel">
      <h2>Logs</h2>
      <div className="panel-empty">
        <div className="panel-empty__icon">📜</div>
        <p>Logs viewer coming soon</p>
        <p className="panel-empty__hint">Workspace ID: {workspaceId}</p>
      </div>
    </div>
  );
};

// ============= Main Component =============

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const {
    currentWorkspace,
    uiBlocks,
    isLoading,
    error,
    loadWorkspace,
    loadUIBlocks,
    pauseWorkspace,
    resumeWorkspace,
    archiveWorkspace,
    deleteWorkspace
  } = useWorkspaceStore();

  useEffect(() => {
    if (id) {
      loadWorkspace(id);
      loadUIBlocks(id);
    }
  }, [id, loadWorkspace, loadUIBlocks]);

  // Built-in tabs
  const builtInTabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'blocks', label: 'Blocks', icon: '🧱' },
    { id: 'sessions', label: 'Sessions', icon: '🔄' },
    { id: 'logs', label: 'Logs', icon: '📜' }
  ];

  // UI block tabs (custom panels from workspace)
  const uiBlockTabs: Tab[] = useMemo(() =>
    uiBlocks
      .filter(b => b.config.displayMode === 'panel')
      .map(b => ({
        id: `ui:${b.id}`,
        label: b.name,
        icon: '🖼️',
        isUIBlock: true,
        blockId: b.id
      })),
    [uiBlocks]
  );

  const allTabs = [...builtInTabs, ...uiBlockTabs];

  const handleDelete = async () => {
    if (!currentWorkspace) return;
    if (confirm('Are you sure you want to delete this workspace? This cannot be undone.')) {
      await deleteWorkspace(currentWorkspace.id);
      navigate('/workspaces');
    }
  };

  const renderContent = () => {
    if (!currentWorkspace) return null;

    switch (activeTab) {
      case 'overview':
        return <OverviewPanel workspace={currentWorkspace} />;
      case 'blocks':
        return <BlocksPanel workspaceId={currentWorkspace.id} />;
      case 'sessions':
        return <SessionsPanel workspaceId={currentWorkspace.id} />;
      case 'logs':
        return <LogsPanel workspaceId={currentWorkspace.id} />;
      default:
        // UI Block tabs
        if (activeTab.startsWith('ui:')) {
          const blockId = activeTab.replace('ui:', '');
          return (
            <UIBlockRenderer
              blockId={blockId}
              workspaceId={currentWorkspace.id}
              displayMode="panel"
            />
          );
        }
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="workspace-detail-page workspace-detail-page--loading">
        <div className="loading-spinner">Loading workspace...</div>
      </div>
    );
  }

  if (error || !currentWorkspace) {
    return (
      <div className="workspace-detail-page workspace-detail-page--error">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error || 'Workspace not found'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/workspaces')}>
            Back to Workspaces
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-detail-page">
      {/* Header */}
      <header className="workspace-detail-page__header">
        <button
          className="workspace-detail-page__back"
          onClick={() => navigate('/workspaces')}
        >
          ← Back
        </button>

        <div className="workspace-detail-page__title-group">
          <h1 className="workspace-detail-page__title">
            {currentWorkspace.name}
          </h1>
          <span className="workspace-detail-page__type">{currentWorkspace.type}</span>
        </div>

        <div className="workspace-detail-page__status">
          {currentWorkspace.status === 'Active' && '🟢'}
          {currentWorkspace.status === 'Paused' && '🟡'}
          {currentWorkspace.status === 'Archived' && '🔵'}
          {' '}{currentWorkspace.status}
        </div>

        <div className="workspace-detail-page__actions">
          {currentWorkspace.status === 'Active' && (
            <button
              className="btn btn-secondary"
              onClick={() => pauseWorkspace(currentWorkspace.id)}
            >
              ⏸️ Pause
            </button>
          )}
          {currentWorkspace.status === 'Paused' && (
            <button
              className="btn btn-primary"
              onClick={() => resumeWorkspace(currentWorkspace.id)}
            >
              ▶️ Resume
            </button>
          )}
          {currentWorkspace.status !== 'Archived' && (
            <button
              className="btn btn-secondary"
              onClick={() => archiveWorkspace(currentWorkspace.id)}
            >
              📥 Archive
            </button>
          )}
          <button className="btn btn-danger" onClick={handleDelete}>
            🗑️ Delete
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="workspace-detail-page__content">
        {/* Sidebar with tabs */}
        <nav className="workspace-detail-page__sidebar">
          <div className="workspace-detail-page__tabs">
            {allTabs.map(tab => (
              <button
                key={tab.id}
                className={`workspace-detail-page__tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="workspace-detail-page__tab-icon">{tab.icon}</span>
                <span className="workspace-detail-page__tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          {uiBlockTabs.length > 0 && (
            <div className="workspace-detail-page__tabs-divider">
              <span>Custom Panels</span>
            </div>
          )}
        </nav>

        {/* Main content area */}
        <main className="workspace-detail-page__main">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default WorkspaceDetailPage;
