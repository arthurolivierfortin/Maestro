/**
 * Projects Page
 *
 * Docker Desktop-style project management page.
 * Phase 8 implementation.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useProjectStore, selectFilteredProjects } from '../store/projectStore';
import { ProjectRow } from '../components/Projects/ProjectRow';
import { FileBrowser } from '../components/Projects/FileBrowser';
import './ProjectsPage.scss';

// ============= Sub-Components =============

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateProjectFormData) => void;
  isLoading: boolean;
}

interface CreateProjectFormData {
  name: string;
  rootPath: string;
  description?: string;
  runtimeType: string;
  dockerImage?: string;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isLoading,
}) => {
  const [step, setStep] = useState<'browse' | 'details'>('browse');
  const [formData, setFormData] = useState<CreateProjectFormData>({
    name: '',
    rootPath: '',
    description: '',
    runtimeType: 'none',
    dockerImage: '',
  });

  useEffect(() => {
    if (isOpen) {
      setStep('browse');
      setFormData({
        name: '',
        rootPath: '',
        description: '',
        runtimeType: 'none',
        dockerImage: '',
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePathSelect = (path: string) => {
    // Extract folder name as default project name
    const folderName = path.split(/[/\\]/).pop() || 'New Project';
    setFormData((prev) => ({
      ...prev,
      rootPath: path,
      name: prev.name || folderName,
    }));
    setStep('details');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{step === 'browse' ? 'Select Project Folder' : 'Project Details'}</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {step === 'browse' ? (
          <div className="modal-body modal-body--browser">
            <FileBrowser onSelect={handlePathSelect} />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="rootPath">Project Path</label>
              <div className="form-group__path-row">
                <input
                  id="rootPath"
                  type="text"
                  value={formData.rootPath}
                  readOnly
                  className="form-group__path-input"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setStep('browse')}
                >
                  Change
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="name">Project Name *</label>
              <input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="My Awesome Project"
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="What is this project about?"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="runtimeType">Runtime Type</label>
              <select
                id="runtimeType"
                value={formData.runtimeType}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, runtimeType: e.target.value }))
                }
              >
                <option value="none">None (Local filesystem)</option>
                <option value="process">Process (Local execution)</option>
                <option value="docker">Docker (Container isolation)</option>
              </select>
              <p className="form-group__help">
                {formData.runtimeType === 'none' &&
                  'Project will run directly on your local filesystem.'}
                {formData.runtimeType === 'process' &&
                  'Project will run as a local process with isolation.'}
                {formData.runtimeType === 'docker' &&
                  'Project will run in an isolated Docker container.'}
              </p>
            </div>

            {formData.runtimeType === 'docker' && (
              <div className="form-group">
                <label htmlFor="dockerImage">Docker Image</label>
                <input
                  id="dockerImage"
                  type="text"
                  value={formData.dockerImage}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dockerImage: e.target.value }))
                  }
                  placeholder="python:3.11-slim or node:18-alpine"
                />
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ============= Main Page =============

const ProjectsPage: React.FC = () => {
  const {
    projects,
    containerStates,
    isLoading,
    error,
    statusFilter,
    fetchProjects,
    createProject,
    deleteProject,
    startContainer,
    stopContainer,
    restartContainer,
    setStatusFilter,
    clearError,
  } = useProjectStore();

  const filteredProjects = useProjectStore(selectFilteredProjects);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (data: CreateProjectFormData) => {
    try {
      await createProject({
        name: data.name,
        rootPath: data.rootPath,
        description: data.description,
        runtime:
          data.runtimeType !== 'none'
            ? {
                type: data.runtimeType,
                image: data.dockerImage,
              }
            : undefined,
      });
      setShowCreateModal(false);
    } catch {
      // Error is handled by store
    }
  };

  // Filter projects by search query
  const displayedProjects = useMemo(() => {
    if (!searchQuery.trim()) return filteredProjects;

    const query = searchQuery.toLowerCase();
    return filteredProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.rootPath.toLowerCase().includes(query)
    );
  }, [filteredProjects, searchQuery]);

  // Count by status
  const runningCount = useMemo(() => {
    return projects.filter((p) => containerStates[p.id]?.status === 'running').length;
  }, [projects, containerStates]);

  return (
    <div className="projects-page">
      {/* Header */}
      <header className="projects-page__header">
        <div className="projects-page__title">
          <h1>Projects</h1>
          <span className="projects-page__count">
            {runningCount > 0 && (
              <span className="projects-page__count-running">{runningCount} running</span>
            )}
            <span className="projects-page__count-total">{projects.length} total</span>
          </span>
        </div>

        <div className="projects-page__actions">
          <div className="projects-page__search">
            <svg
              className="projects-page__search-icon"
              viewBox="0 0 16 16"
              fill="currentColor"
              width="16"
              height="16"
            >
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="projects-page__search-input"
            />
          </div>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            + New Project
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="projects-page__filters">
        <button
          className={`projects-page__filter ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All
          <span className="projects-page__filter-count">{projects.length}</span>
        </button>
        <button
          className={`projects-page__filter ${statusFilter === 'running' ? 'active' : ''}`}
          onClick={() => setStatusFilter('running')}
        >
          Running
          <span className="projects-page__filter-count">{runningCount}</span>
        </button>
        <button
          className={`projects-page__filter ${statusFilter === 'stopped' ? 'active' : ''}`}
          onClick={() => setStatusFilter('stopped')}
        >
          Stopped
          <span className="projects-page__filter-count">{projects.length - runningCount}</span>
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}

      {/* Content */}
      <div className="projects-page__content">
        {isLoading && projects.length === 0 ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading projects...</p>
          </div>
        ) : displayedProjects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📂</div>
            <h2>
              {searchQuery
                ? 'No Projects Found'
                : statusFilter !== 'all'
                ? `No ${statusFilter} projects`
                : 'No Projects Yet'}
            </h2>
            <p>
              {searchQuery
                ? `No projects match "${searchQuery}"`
                : statusFilter !== 'all'
                ? `You don't have any ${statusFilter} projects`
                : 'Get started by creating your first project'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                Create Your First Project
              </button>
            )}
          </div>
        ) : (
          <div className="projects-list">
            {displayedProjects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                containerState={containerStates[project.id]}
                onStart={startContainer}
                onStop={stopContainer}
                onRestart={restartContainer}
                onDelete={deleteProject}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateProject}
        isLoading={isLoading}
      />
    </div>
  );
};

export default ProjectsPage;
