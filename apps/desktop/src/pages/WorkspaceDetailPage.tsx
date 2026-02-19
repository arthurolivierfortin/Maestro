/**
 * Workspace Detail Page
 *
 * Generic workspace detail view with UI block slot.
 * Shows generic overview + custom UI panels defined by workspace.
 * Includes Vivado-inspired canvas view for session visualization.
 * Uses Lucide icons for consistency.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  LayoutDashboard,
  Palette,
  Layers,
  RefreshCw,
  FileText,
  Image,
  Play,
  Pause,
  Clock,
  CheckCircle,
  XCircle,
  StopCircle,
  Archive,
  Trash2,
  Circle,
  GitBranch,
} from 'lucide-react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useSessionStore } from '../store/sessionStore';
import { UIBlockRenderer } from '../components/ui-block';
import {
  BlocksPanel,
  LogsPanel,
  QuickActions,
  WorkspaceContent,
  RecentActivity,
  WorkspaceHealth,
  EntryPointCard,
  BlockCompositionDiagram,
  WorkflowExplorerPanel,
} from '../components/workspace';
import { WorkspaceLiveView } from '../components/workspace/WorkspaceLiveView';
import { Button } from '../components/common/Button';
import { useBlockStore } from '../store/blockStore';
import type { Session } from '../types/session.types';
import type { Block } from '../types/block.types';
import type { EntryPoint } from '../types/workspace-canvas.types';
import './WorkspaceDetailPage.scss';

// ============= Tab Types =============

type TabId = 'overview' | 'canvas' | 'blocks' | 'sessions' | 'logs' | string;

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  isUIBlock?: boolean;
  blockId?: string;
}

// ============= Status Icon Component =============

const StatusIcon: React.FC<{ status: string; size?: number }> = ({ status, size = 14 }) => {
  const props = { size };
  switch (status) {
    case 'Active':
      return <Circle {...props} fill="#22c55e" color="#22c55e" />;
    case 'Running':
      return <Play {...props} fill="#3b82f6" color="#3b82f6" />;
    case 'Pending':
      return <Clock {...props} color="#8b5cf6" />;
    case 'Paused':
      return <Pause {...props} color="#f59e0b" />;
    case 'Completed':
      return <CheckCircle {...props} color="#22c55e" />;
    case 'Failed':
      return <XCircle {...props} color="#ef4444" />;
    case 'Cancelled':
      return <StopCircle {...props} color="#6b7280" />;
    case 'Archived':
      return <Archive {...props} color="#6b7280" />;
    default:
      return <Circle {...props} color="#6b7280" />;
  }
};

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
    entryPoints?: Array<{
      blockId: string;
      name: string;
      description?: string;
      type: 'main' | 'dashboard' | 'experiments' | 'settings' | 'custom';
    }>;
  };
  blocks: Block[];
  onNavigateToBlocks?: () => void;
  onNavigateToCanvas?: () => void;
  onStartSession?: (blockId: string) => void;
  onBlockClick?: (blockId: string) => void;
}

const OverviewPanel: React.FC<OverviewPanelProps> = ({
  workspace,
  blocks,
  onNavigateToBlocks,
  onNavigateToCanvas,
  onStartSession,
  onBlockClick,
}) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  // Get entry points from workspace or use mock data
  const entryPoints: EntryPoint[] = useMemo(() => {
    if (Array.isArray(workspace.entryPoints) && workspace.entryPoints.length > 0) {
      return workspace.entryPoints.map(ep => ({
        blockId: ep.blockId,
        name: ep.name,
        description: ep.description,
        type: ep.type,
      }));
    }
    // Mock entry points for research workspace
    if (workspace.type === 'Research') {
      return [
        { blockId: 'research-team', name: 'Run Research Team', type: 'main' as const },
        { blockId: 'experiment-manager', name: 'Manage Experiments', type: 'experiments' as const },
        { blockId: 'leaderboard', name: 'View Leaderboard', type: 'dashboard' as const },
      ];
    }
    return [];
  }, [workspace.entryPoints, workspace.type]);

  // Get blocks for entry points
  const entryPointBlocks = useMemo(() => {
    const blockMap: Record<string, Block | null> = {};
    for (const ep of entryPoints) {
      blockMap[ep.blockId] = blocks.find(b => b.id === ep.blockId) || null;
    }
    return blockMap;
  }, [entryPoints, blocks]);

  return (
    <div className="overview-panel">
      <h2>Overview</h2>

      {/* Quick Actions Section */}
      <QuickActions
        workspaceId={workspace.id}
        entryPoints={entryPoints}
      />

      {/* Entry Points with Previews */}
      {entryPoints.length > 0 && (
        <div className="overview-panel__section">
          <h3>Entry Points</h3>
          <div className="overview-panel__entry-points-grid">
            {entryPoints.map(ep => (
              <EntryPointCard
                key={ep.blockId}
                entryPoint={ep}
                block={entryPointBlocks[ep.blockId]}
                workspaceId={workspace.id}
                onStart={() => onStartSession?.(ep.blockId)}
                onPreview={() => onNavigateToCanvas?.()}
              />
            ))}
          </div>
        </div>
      )}

      {/* Block Composition Diagram */}
      {blocks.length > 0 && (
        <div className="overview-panel__section">
          <BlockCompositionDiagram
            blocks={blocks}
            onBlockClick={onBlockClick}
            onViewAll={onNavigateToBlocks}
          />
        </div>
      )}

      {/* Status Grid */}
      <div className="overview-panel__grid">
        <div className="overview-panel__card">
          <div className="overview-panel__card-label">Status</div>
          <div className="overview-panel__card-value overview-panel__card-value--status">
            <StatusIcon status={workspace.status} />
            <span>{workspace.status}</span>
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

      {/* Workspace Content Summary */}
      <WorkspaceContent
        workspaceId={workspace.id}
        onViewAll={onNavigateToBlocks}
      />

      {/* Workspace Health KPIs */}
      <WorkspaceHealth workspaceId={workspace.id} />

      {/* Recent Activity */}
      <RecentActivity workspaceId={workspace.id} limit={5} />

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
        <div className="panel-empty__icon">
          <RefreshCw size={48} strokeWidth={1.5} />
        </div>
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
              <StatusIcon status={session.status} size={20} />
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

// ============= Main Component =============

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const {
    currentWorkspace,
    uiBlocks,
    topology,
    isLoading,
    error,
    loadWorkspace,
    loadUIBlocks,
    loadTopology,
    pauseWorkspace,
    resumeWorkspace,
    archiveWorkspace,
    deleteWorkspace
  } = useWorkspaceStore();

  const { sessions, loadSessions } = useSessionStore();
  const blocksMap = useBlockStore((state) => state.blocks);
  const allBlocks = useMemo(() => Array.from(blocksMap.values()), [blocksMap]);

  // Filter sessions for current workspace
  const workspaceSessions = useMemo<Session[]>(() => {
    if (!currentWorkspace) return [];
    return sessions
      .filter(s => s.workspaceId === currentWorkspace.id)
      .map(summary => ({
        ...summary,
        executions: [],
        recentLogs: [],
      } as Session));
  }, [sessions, currentWorkspace]);

  useEffect(() => {
    if (id) {
      loadWorkspace(id);
      loadUIBlocks(id);
      loadTopology();
      loadSessions({ workspaceId: id });
    }
  }, [id, loadWorkspace, loadUIBlocks, loadTopology, loadSessions]);

  // Handle external workspace click (navigate to that workspace)
  const handleExternalWorkspaceClick = useCallback((workspaceId: string) => {
    navigate(`/workspaces/${workspaceId}`);
  }, [navigate]);

  // Built-in tabs
  const builtInTabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
    { id: 'canvas', label: 'Canvas', icon: <Palette size={16} /> },
    { id: 'workflows', label: 'Workflows', icon: <GitBranch size={16} /> },
    { id: 'blocks', label: 'Blocks', icon: <Layers size={16} /> },
    { id: 'sessions', label: 'Sessions', icon: <RefreshCw size={16} /> },
    { id: 'logs', label: 'Logs', icon: <FileText size={16} /> }
  ];

  // UI block tabs (custom panels from workspace)
  const uiBlockTabs: Tab[] = useMemo(() =>
    uiBlocks
      .filter(b => b.config.displayMode === 'panel')
      .map(b => ({
        id: `ui:${b.id}`,
        label: b.name,
        icon: <Image size={16} />,
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

  const handleNavigateToBlocks = useCallback(() => {
    setActiveTab('blocks');
  }, []);

  const handleNavigateToCanvas = useCallback(() => {
    setActiveTab('canvas');
  }, []);

  const handleStartSession = useCallback((blockId: string) => {
    // TODO: Implement session start
    console.log('Start session with block:', blockId);
  }, []);

  const handleBlockClick = useCallback((_blockId: string) => {
    // Navigate to blocks tab and select the block
    setActiveTab('blocks');
    // TODO: Add block selection state using _blockId
  }, []);

  const renderContent = () => {
    if (!currentWorkspace) return null;

    switch (activeTab) {
      case 'overview':
        return (
          <OverviewPanel
            workspace={currentWorkspace}
            blocks={allBlocks}
            onNavigateToBlocks={handleNavigateToBlocks}
            onNavigateToCanvas={handleNavigateToCanvas}
            onStartSession={handleStartSession}
            onBlockClick={handleBlockClick}
          />
        );
      case 'canvas':
        return (
          <div className="workspace-detail-page__live-view-container">
            <WorkspaceLiveView
              workspace={currentWorkspace}
              sessions={workspaceSessions}
              topology={topology}
              isLoading={isLoading}
              onNavigateToWorkspace={handleExternalWorkspaceClick}
              onNavigateToLogs={() => setActiveTab('logs')}
              blocks={allBlocks}
            />
          </div>
        );
      case 'workflows':
        return (
          <WorkflowExplorerPanel
            blocks={allBlocks}
            onStartSession={handleStartSession}
            onViewWorkflow={handleBlockClick}
          />
        );
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
          <Button
            variant="primary"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/workspaces')}
          >
            Back to Workspaces
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-detail-page">
      {/* Header */}
      <header className="workspace-detail-page__header">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate('/workspaces')}
        >
          Back
        </Button>

        <div className="workspace-detail-page__title-group">
          <h1 className="workspace-detail-page__title">
            {currentWorkspace.name}
          </h1>
          <span className="workspace-detail-page__type">{currentWorkspace.type}</span>
        </div>

        <div className="workspace-detail-page__status">
          <StatusIcon status={currentWorkspace.status} />
          <span>{currentWorkspace.status}</span>
        </div>

        <div className="workspace-detail-page__actions">
          {currentWorkspace.status === 'Active' && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Pause size={14} />}
              onClick={() => pauseWorkspace(currentWorkspace.id)}
            >
              Pause
            </Button>
          )}
          {currentWorkspace.status === 'Paused' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Play size={14} />}
              onClick={() => resumeWorkspace(currentWorkspace.id)}
            >
              Resume
            </Button>
          )}
          {currentWorkspace.status !== 'Archived' && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Archive size={14} />}
              onClick={() => archiveWorkspace(currentWorkspace.id)}
            >
              Archive
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={14} />}
            onClick={handleDelete}
          >
            Delete
          </Button>
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
