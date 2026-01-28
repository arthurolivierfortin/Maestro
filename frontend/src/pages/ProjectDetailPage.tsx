/**
 * Project Detail Page
 *
 * Comprehensive project management page with tabs for different functions.
 * Phase 8 implementation.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore, Project, FileAccessRule, BlockPermission } from '../store/projectStore';
import { ContainerState, containerService } from '../services/containerService';
import { ProjectStatusBadge } from '../components/Projects/ProjectStatusBadge';
import { ContainerControls } from '../components/Projects/ContainerControls';
import { ProjectTerminal } from '../components/Terminal/ProjectTerminal';
import './ProjectDetailPage.scss';

// ============= Types =============

type TabId = 'overview' | 'terminal' | 'blocks' | 'files' | 'logs';

// ============= Sub-Components =============

interface TabButtonProps {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: (id: TabId) => void;
}

const TabButton: React.FC<TabButtonProps> = ({ id, label, icon, active, onClick }) => (
  <button
    className={`project-detail__tab ${active ? 'active' : ''}`}
    onClick={() => onClick(id)}
  >
    {icon}
    <span>{label}</span>
  </button>
);

// Overview Tab
interface OverviewTabProps {
  project: Project;
  containerState?: ContainerState;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ project, containerState }) => {
  const status = containerState?.status || 'stopped';
  const hasRuntime = project.runtime?.type !== undefined && project.runtime.type !== 'none';

  return (
    <div className="overview-tab">
      <div className="overview-tab__grid">
        {/* Status Card */}
        <div className="overview-tab__card">
          <h3>Status</h3>
          <div className="overview-tab__status">
            <ProjectStatusBadge status={status} />
            {containerState?.startedAt && status === 'running' && (
              <span className="overview-tab__uptime">
                Started {new Date(containerState.startedAt).toLocaleString()}
              </span>
            )}
          </div>
          {containerState?.containerId && (
            <div className="overview-tab__container-id">
              Container: <code>{containerState.containerId.substring(0, 12)}</code>
            </div>
          )}
        </div>

        {/* Runtime Card */}
        <div className="overview-tab__card">
          <h3>Runtime</h3>
          <div className="overview-tab__runtime">
            <span className="overview-tab__runtime-type">
              {hasRuntime ? (
                <>
                  {project.runtime?.type === 'docker' ? '🐳 Docker' : '⚡ Process'}
                </>
              ) : (
                '📁 Local'
              )}
            </span>
            {project.runtime?.image && (
              <span className="overview-tab__runtime-image">
                Image: <code>{project.runtime.image}</code>
              </span>
            )}
          </div>
        </div>

        {/* Resources Card */}
        {containerState?.resourceUsage && (
          <div className="overview-tab__card">
            <h3>Resources</h3>
            <div className="overview-tab__resources">
              <div className="overview-tab__resource">
                <span className="overview-tab__resource-label">CPU</span>
                <span className="overview-tab__resource-value">
                  {containerState.resourceUsage.cpuPercent.toFixed(1)}%
                </span>
              </div>
              <div className="overview-tab__resource">
                <span className="overview-tab__resource-label">Memory</span>
                <span className="overview-tab__resource-value">
                  {containerState.resourceUsage.memoryMb.toFixed(0)} MB
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Path Card */}
        <div className="overview-tab__card overview-tab__card--full">
          <h3>Project Path</h3>
          <code className="overview-tab__path">{project.rootPath}</code>
        </div>

        {/* Info Card */}
        <div className="overview-tab__card overview-tab__card--full">
          <h3>Information</h3>
          <div className="overview-tab__info-grid">
            <div className="overview-tab__info-item">
              <span className="overview-tab__info-label">Version</span>
              <span className="overview-tab__info-value">{project.version}</span>
            </div>
            <div className="overview-tab__info-item">
              <span className="overview-tab__info-label">Created</span>
              <span className="overview-tab__info-value">
                {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="overview-tab__info-item">
              <span className="overview-tab__info-label">Updated</span>
              <span className="overview-tab__info-value">
                {new Date(project.updatedAt).toLocaleDateString()}
              </span>
            </div>
            {project.defaultModel && (
              <div className="overview-tab__info-item">
                <span className="overview-tab__info-label">Default Model</span>
                <span className="overview-tab__info-value">{project.defaultModel}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Terminal Tab
interface TerminalTabProps {
  project: Project;
  containerState?: ContainerState;
}

const TerminalTab: React.FC<TerminalTabProps> = ({ project, containerState }) => {
  const status = containerState?.status || 'stopped';
  const isRunning = status === 'running';

  return (
    <div className="terminal-tab">
      {isRunning ? (
        <ProjectTerminal
          projectId={project.id}
          containerId={containerState?.containerId}
          onConnect={() => console.log('Terminal connected')}
          onDisconnect={() => console.log('Terminal disconnected')}
          onError={(error) => console.error('Terminal error:', error)}
        />
      ) : (
        <div className="terminal-tab__not-running">
          <div className="terminal-tab__not-running-icon">💤</div>
          <h3>Container Not Running</h3>
          <p>Start the container to access the terminal.</p>
        </div>
      )}
    </div>
  );
};

// Blocks Tab
interface BlocksTabProps {
  project: Project;
  onUpdatePermissions: (permissions: BlockPermission[]) => Promise<void>;
}

const BlocksTab: React.FC<BlocksTabProps> = ({ project, onUpdatePermissions }) => {
  const [permissions, setPermissions] = useState<BlockPermission[]>(
    project.blockPermissions || []
  );
  const [newPattern, setNewPattern] = useState('');
  const [newPermission, setNewPermission] = useState<'allowed' | 'denied' | 'requiresapproval'>(
    'allowed'
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleAddPermission = () => {
    if (!newPattern.trim()) return;

    const newPerm: BlockPermission = {
      blockPattern: newPattern.trim(),
      permission: newPermission,
    };
    setPermissions([...permissions, newPerm]);
    setNewPattern('');
  };

  const handleRemovePermission = (index: number) => {
    setPermissions(permissions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdatePermissions(permissions);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="blocks-tab">
      <div className="blocks-tab__header">
        <h3>Block Permissions</h3>
        <p>Control which blocks and tools are available in this project.</p>
      </div>

      {/* Add new permission */}
      <div className="blocks-tab__add-form">
        <input
          type="text"
          placeholder="Block pattern (e.g., tools/* or tools/shell-exec)"
          value={newPattern}
          onChange={(e) => setNewPattern(e.target.value)}
          className="blocks-tab__input"
        />
        <select
          value={newPermission}
          onChange={(e) =>
            setNewPermission(e.target.value as 'allowed' | 'denied' | 'requiresapproval')
          }
          className="blocks-tab__select"
        >
          <option value="allowed">Allowed</option>
          <option value="denied">Denied</option>
          <option value="requiresapproval">Requires Approval</option>
        </select>
        <button className="btn-secondary" onClick={handleAddPermission}>
          Add
        </button>
      </div>

      {/* Permissions list */}
      <div className="blocks-tab__list">
        {permissions.length === 0 ? (
          <div className="blocks-tab__empty">
            No custom permissions. All blocks are allowed by default.
          </div>
        ) : (
          permissions.map((perm, index) => (
            <div key={index} className="blocks-tab__item">
              <span className="blocks-tab__pattern">{perm.blockPattern}</span>
              <span
                className={`blocks-tab__permission blocks-tab__permission--${perm.permission}`}
              >
                {perm.permission === 'allowed'
                  ? '✓ Allowed'
                  : perm.permission === 'denied'
                  ? '✗ Denied'
                  : '⚠ Requires Approval'}
              </span>
              <button
                className="blocks-tab__remove"
                onClick={() => handleRemovePermission(index)}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {/* Save button */}
      <div className="blocks-tab__actions">
        <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Permissions'}
        </button>
      </div>
    </div>
  );
};

// Files Tab
interface FilesTabProps {
  project: Project;
  onUpdateRules: (rules: FileAccessRule[]) => Promise<void>;
}

const FilesTab: React.FC<FilesTabProps> = ({ project, onUpdateRules }) => {
  const [rules, setRules] = useState<FileAccessRule[]>(project.fileAccessRules || []);
  const [newPath, setNewPath] = useState('');
  const [newType, setNewType] = useState<'file' | 'directory'>('file');
  const [newPermission, setNewPermission] = useState<
    'readwrite' | 'readonly' | 'hidden' | 'excluded'
  >('hidden');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddRule = () => {
    if (!newPath.trim()) return;

    const newRule: FileAccessRule = {
      path: newPath.trim(),
      type: newType,
      permission: newPermission,
    };
    setRules([...rules, newRule]);
    setNewPath('');
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateRules(rules);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="files-tab">
      <div className="files-tab__header">
        <h3>File Access Rules</h3>
        <p>Control which files and folders are visible or accessible to agents.</p>
      </div>

      {/* Add new rule */}
      <div className="files-tab__add-form">
        <input
          type="text"
          placeholder="Path (e.g., .env or node_modules/)"
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          className="files-tab__input"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as 'file' | 'directory')}
          className="files-tab__select files-tab__select--small"
        >
          <option value="file">File</option>
          <option value="directory">Directory</option>
        </select>
        <select
          value={newPermission}
          onChange={(e) =>
            setNewPermission(
              e.target.value as 'readwrite' | 'readonly' | 'hidden' | 'excluded'
            )
          }
          className="files-tab__select"
        >
          <option value="readwrite">Read/Write</option>
          <option value="readonly">Read Only</option>
          <option value="hidden">Hidden</option>
          <option value="excluded">Excluded</option>
        </select>
        <button className="btn-secondary" onClick={handleAddRule}>
          Add
        </button>
      </div>

      {/* Rules list */}
      <div className="files-tab__list">
        {rules.length === 0 ? (
          <div className="files-tab__empty">No file access rules. All files are accessible.</div>
        ) : (
          rules.map((rule, index) => (
            <div key={index} className="files-tab__item">
              <span className="files-tab__type">
                {rule.type === 'directory' ? '📁' : '📄'}
              </span>
              <span className="files-tab__path">{rule.path}</span>
              <span className={`files-tab__permission files-tab__permission--${rule.permission}`}>
                {rule.permission === 'readwrite'
                  ? '✓ Read/Write'
                  : rule.permission === 'readonly'
                  ? '👁 Read Only'
                  : rule.permission === 'hidden'
                  ? '👻 Hidden'
                  : '⊘ Excluded'}
              </span>
              <button className="files-tab__remove" onClick={() => handleRemoveRule(index)}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {/* Save button */}
      <div className="files-tab__actions">
        <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Rules'}
        </button>
      </div>
    </div>
  );
};

// Logs Tab
interface LogsTabProps {
  projectId: string;
  containerState?: ContainerState;
}

const LogsTab: React.FC<LogsTabProps> = ({ projectId, containerState }) => {
  const [logs, setLogs] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const status = containerState?.status || 'stopped';

  const loadLogs = useCallback(async () => {
    if (!containerState?.containerId) return;

    setIsLoading(true);
    try {
      const logContent = await containerService.getLogs(projectId, 200);
      setLogs(logContent);
    } catch (error) {
      setLogs(`Error loading logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, containerState?.containerId]);

  useEffect(() => {
    if (containerState?.containerId) {
      loadLogs();
    }
  }, [containerState?.containerId, loadLogs]);

  return (
    <div className="logs-tab">
      <div className="logs-tab__header">
        <h3>Container Logs</h3>
        <button className="btn-secondary" onClick={loadLogs} disabled={isLoading || !containerState?.containerId}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="logs-tab__content">
        {status === 'stopped' && !logs ? (
          <div className="logs-tab__empty">
            <p>No logs available. Start the container to see logs.</p>
          </div>
        ) : (
          <pre className="logs-tab__output">{logs || 'No logs yet...'}</pre>
        )}
      </div>
    </div>
  );
};

// ============= Main Page =============

const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    currentProject,
    containerStates,
    isLoading,
    error,
    getProject,
    startContainer,
    stopContainer,
    restartContainer,
    updateFileRules,
    updateBlockPermissions,
    clearError,
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const containerState = id ? containerStates[id] : undefined;

  useEffect(() => {
    if (id) {
      getProject(id);
    }
  }, [id, getProject]);

  const handleBack = () => {
    navigate('/projects');
  };

  const handleUpdateFileRules = async (rules: FileAccessRule[]) => {
    if (id) {
      await updateFileRules(id, rules);
    }
  };

  const handleUpdateBlockPermissions = async (permissions: BlockPermission[]) => {
    if (id) {
      await updateBlockPermissions(id, permissions);
    }
  };

  if (isLoading && !currentProject) {
    return (
      <div className="project-detail project-detail--loading">
        <div className="spinner" />
        <p>Loading project...</p>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="project-detail project-detail--not-found">
        <h2>Project Not Found</h2>
        <p>The project you're looking for doesn't exist.</p>
        <button className="btn-primary" onClick={handleBack}>
          Back to Projects
        </button>
      </div>
    );
  }

  const status = containerState?.status || 'stopped';
  const hasRuntime =
    currentProject.runtime?.type !== undefined && currentProject.runtime.type !== 'none';

  return (
    <div className="project-detail">
      {/* Header */}
      <header className="project-detail__header">
        <div className="project-detail__header-left">
          <button className="project-detail__back" onClick={handleBack}>
            <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
              <path
                fillRule="evenodd"
                d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5z"
              />
            </svg>
            Back
          </button>
          <h1 className="project-detail__title">{currentProject.name}</h1>
          <ProjectStatusBadge status={status} />
        </div>

        <div className="project-detail__header-right">
          <ContainerControls
            status={status}
            hasRuntime={hasRuntime}
            onStart={() => id && startContainer(id)}
            onStop={() => id && stopContainer(id)}
            onRestart={() => id && restartContainer(id)}
          />
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <nav className="project-detail__tabs">
        <TabButton
          id="overview"
          label="Overview"
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1a6 6 0 1 1 0 12A6 6 0 0 1 8 2z" />
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
            </svg>
          }
          active={activeTab === 'overview'}
          onClick={setActiveTab}
        />
        <TabButton
          id="terminal"
          label="Terminal"
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
              <path d="M6 9a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3A.5.5 0 0 1 6 9zM3.854 4.146a.5.5 0 1 0-.708.708L4.793 6.5 3.146 8.146a.5.5 0 1 0 .708.708l2-2a.5.5 0 0 0 0-.708l-2-2z" />
              <path d="M2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H2zm12 1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h12z" />
            </svg>
          }
          active={activeTab === 'terminal'}
          onClick={setActiveTab}
        />
        <TabButton
          id="blocks"
          label="Blocks"
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
              <path d="M7.752.066a.5.5 0 0 1 .496 0l3.75 2.143a.5.5 0 0 1 .252.434v3.995l3.498 2A.5.5 0 0 1 16 9.07v4.286a.5.5 0 0 1-.252.434l-3.75 2.143a.5.5 0 0 1-.496 0l-3.502-2-3.502 2.001a.5.5 0 0 1-.496 0l-3.75-2.143A.5.5 0 0 1 0 13.357V9.071a.5.5 0 0 1 .252-.434L3.75 6.638V2.643a.5.5 0 0 1 .252-.434L7.752.066z" />
            </svg>
          }
          active={activeTab === 'blocks'}
          onClick={setActiveTab}
        />
        <TabButton
          id="files"
          label="Files"
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
              <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z" />
            </svg>
          }
          active={activeTab === 'files'}
          onClick={setActiveTab}
        />
        <TabButton
          id="logs"
          label="Logs"
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
              <path d="M5 4a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5zm-.5 2.5A.5.5 0 0 1 5 6h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5zM5 8a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5zm0 2a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1H5z" />
              <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm10-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z" />
            </svg>
          }
          active={activeTab === 'logs'}
          onClick={setActiveTab}
        />
      </nav>

      {/* Tab Content */}
      <div className="project-detail__content">
        {activeTab === 'overview' && (
          <OverviewTab project={currentProject} containerState={containerState} />
        )}
        {activeTab === 'terminal' && (
          <TerminalTab project={currentProject} containerState={containerState} />
        )}
        {activeTab === 'blocks' && (
          <BlocksTab project={currentProject} onUpdatePermissions={handleUpdateBlockPermissions} />
        )}
        {activeTab === 'files' && (
          <FilesTab project={currentProject} onUpdateRules={handleUpdateFileRules} />
        )}
        {activeTab === 'logs' && id && (
          <LogsTab projectId={id} containerState={containerState} />
        )}
      </div>
    </div>
  );
};

export default ProjectDetailPage;
