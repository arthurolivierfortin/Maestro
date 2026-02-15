/**
 * Workspaces Page
 *
 * Generic workspace list page following Docker Desktop style.
 * Workspaces are containers for blocks and sessions - no domain-specific UI.
 * Custom UI comes from UI blocks within each workspace.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '../store/workspaceStore';
import { Badge, StatusIndicator, LoadingState, ErrorState, EmptyState as UiEmptyState } from '@components/ui';
import type { WorkspaceStatus, CreateWorkspaceRequest } from '../types/workspace.types';
import './WorkspacesPage.scss';

// ============= Sub-Components =============

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateWorkspaceRequest) => void;
  isLoading: boolean;
}

const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isLoading,
}) => {
  const [formData, setFormData] = useState<CreateWorkspaceRequest>({
    name: '',
    description: '',
    type: 'Custom',
    settings: { tags: [] },
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: '',
        type: 'Custom',
        settings: { tags: [] },
      });
      setTagInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onCreate(formData);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.settings?.tags?.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          tags: [...(prev.settings?.tags || []), tagInput.trim()]
        }
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        tags: prev.settings?.tags?.filter(t => t !== tag) || []
      }
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Workspace</h2>
          <button className="modal-close" onClick={onClose}>X</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="my-workspace"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What will this workspace be used for?"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="type">Type</label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
            >
              <option value="Research">Research</option>
              <option value="Training">Training</option>
              <option value="Staging">Staging</option>
              <option value="Production">Production</option>
              <option value="Custom">Custom</option>
            </select>
          </div>

          <div className="form-group">
            <label>Tags</label>
            <div className="tag-input-container">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag..."
              />
              <button type="button" onClick={handleAddTag} className="btn btn-secondary btn-sm">
                Add
              </button>
            </div>
            <div className="tags-list">
              {formData.settings?.tags?.map(tag => (
                <span key={tag} className="tag">
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)}>x</button>
                </span>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading || !formData.name.trim()}>
              {isLoading ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Workspace Row Component
interface WorkspaceRowProps {
  workspace: {
    id: string;
    name: string;
    description?: string;
    type: string;
    status: WorkspaceStatus;
    sessionIds: string[];
    projectIds: string[];
    settings: { tags: string[] };
    createdAt: string;
    updatedAt: string;
  };
  onOpen: () => void;
  onPause: () => void;
  onResume: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

const wsStatusToIndicator = (status: WorkspaceStatus) => {
  const map: Record<WorkspaceStatus, 'success' | 'warning' | 'pending'> = {
    Active: 'success', Paused: 'warning', Archived: 'pending',
  };
  return map[status] || 'pending';
};

const WorkspaceRow: React.FC<WorkspaceRowProps> = ({
  workspace,
  onOpen,
  onPause,
  onResume,
  onArchive,
  onDelete,
}) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="workspace-row">
      <div className="workspace-row__icon">
        <StatusIndicator status={wsStatusToIndicator(workspace.status)} size="md" />
      </div>

      <div className="workspace-row__content" onClick={onOpen}>
        <div className="workspace-row__header">
          <span className="workspace-row__name">{workspace.name}</span>
          <Badge variant="muted" size="sm">{workspace.type}</Badge>
        </div>
        <div className="workspace-row__meta">
          <Badge variant={workspace.status === 'Active' ? 'success' : 'muted'} size="sm">
            {workspace.status}
          </Badge>
          <span className="workspace-row__sessions">
            {workspace.sessionIds.length} sessions
          </span>
          <span className="workspace-row__projects">
            {workspace.projectIds.length} projects
          </span>
          <span className="workspace-row__date">
            {formatDate(workspace.createdAt)}
          </span>
        </div>
        {workspace.description && (
          <div className="workspace-row__description">{workspace.description}</div>
        )}
        {workspace.settings.tags.length > 0 && (
          <div className="workspace-row__tags">
            {workspace.settings.tags.map(tag => (
              <Badge key={tag} variant="default" size="sm">{tag}</Badge>
            ))}
          </div>
        )}
      </div>

      <div className="workspace-row__actions">
        <button className="btn btn-primary btn-sm" onClick={onOpen}>
          Open
        </button>
        {workspace.status === 'Active' && (
          <button className="btn btn-secondary btn-sm" onClick={onPause} title="Pause">
            &#9208;
          </button>
        )}
        {workspace.status === 'Paused' && (
          <button className="btn btn-secondary btn-sm" onClick={onResume} title="Resume">
            &#9654;
          </button>
        )}
        {workspace.status !== 'Archived' && (
          <button className="btn btn-secondary btn-sm" onClick={onArchive} title="Archive">
            &#128229;
          </button>
        )}
        <button className="btn btn-danger btn-sm" onClick={onDelete} title="Delete">
          &#128465;
        </button>
      </div>
    </div>
  );
};

// Empty State wraps the shared component
const WorkspaceEmptyState: React.FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <UiEmptyState
    title="No workspaces found"
    message="Create your first workspace to organize blocks and sessions."
    onAction={onCreate}
    actionLabel="Create Workspace"
  />
);

// ============= Main Component =============

type FilterStatus = WorkspaceStatus | 'All';

const STATUS_FILTERS: { status: FilterStatus; label: string }[] = [
  { status: 'All', label: 'All' },
  { status: 'Active', label: 'Active' },
  { status: 'Paused', label: 'Paused' },
  { status: 'Archived', label: 'Archived' },
];

export function WorkspacesPage() {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    workspaces,
    isLoading,
    error,
    statusFilter,
    searchQuery,
    loadWorkspaces,
    createWorkspace,
    deleteWorkspace,
    pauseWorkspace,
    resumeWorkspace,
    archiveWorkspace,
    setStatusFilter,
    setSearchQuery,
    filteredWorkspaces,
    countByStatus,
  } = useWorkspaceStore();

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const filtered = useMemo(() => filteredWorkspaces(), [workspaces, statusFilter, searchQuery]);
  const counts = useMemo(() => countByStatus(), [workspaces]);

  const handleCreate = async (data: CreateWorkspaceRequest) => {
    try {
      const workspace = await createWorkspace(data);
      setShowCreateModal(false);
      navigate(`/workspaces/${workspace.id}`);
    } catch (err) {
      // Error is handled by store
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this workspace?')) {
      await deleteWorkspace(id);
    }
  };

  return (
    <div className="workspaces-page page-enter">
      {/* Header */}
      <header className="workspaces-page__header">
        <div className="workspaces-page__title">
          <h1>Workspaces</h1>
          <div className="workspaces-page__count">
            <span className="workspaces-page__count-active">{counts.Active} active</span>
            <span className="workspaces-page__count-total">{counts.All} total</span>
          </div>
        </div>

        <div className="workspaces-page__actions">
          <div className="workspaces-page__search">
            <span className="workspaces-page__search-icon">🔍</span>
            <input
              type="text"
              className="workspaces-page__search-input"
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + New Workspace
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="workspaces-page__filters">
        {STATUS_FILTERS.map(({ status, label }) => (
          <button
            key={status}
            className={`workspaces-page__filter ${statusFilter === status ? 'active' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {label}
            <span className="workspaces-page__filter-count">{counts[status]}</span>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="workspaces-page__error">
          <ErrorState message="Failed to load workspaces" detail={error} onRetry={loadWorkspaces} />
        </div>
      )}

      {/* Content */}
      <div className="workspaces-page__content">
        {isLoading ? (
          <LoadingState message="Loading workspaces..." lines={4} />
        ) : filtered.length === 0 ? (
          <WorkspaceEmptyState onCreate={() => setShowCreateModal(true)} />
        ) : (
          <div className="workspaces-list">
            {filtered.map(workspace => (
              <WorkspaceRow
                key={workspace.id}
                workspace={workspace}
                onOpen={() => navigate(`/workspaces/${workspace.id}`)}
                onPause={() => pauseWorkspace(workspace.id)}
                onResume={() => resumeWorkspace(workspace.id)}
                onArchive={() => archiveWorkspace(workspace.id)}
                onDelete={() => handleDelete(workspace.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
        isLoading={isLoading}
      />
    </div>
  );
}

export default WorkspacesPage;
