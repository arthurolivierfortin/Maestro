/**
 * Projects Page
 * 
 * Main page for managing Maestro projects.
 * Phase 7E implementation.
 */

import React, { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import './ProjectsPage.scss';

// ============= Sub-Components =============

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description?: string;
    rootPath: string;
    runtime?: { type: string; image?: string };
    version: string;
    updatedAt: string;
  };
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onSelect, onDelete, isSelected }) => {
  const runtimeIcon = {
    docker: '🐳',
    process: '⚡',
    none: '📁',
  }[project.runtime?.type || 'none'] || '📁';

  return (
    <div 
      className={`project-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(project.id)}
    >
      <div className="project-card__header">
        <span className="project-card__runtime">{runtimeIcon}</span>
        <h3 className="project-card__name">{project.name}</h3>
        <span className="project-card__version">v{project.version}</span>
      </div>
      
      <p className="project-card__description">
        {project.description || 'No description'}
      </p>
      
      <div className="project-card__path">
        <span className="label">Path:</span>
        <span className="value" title={project.rootPath}>
          {project.rootPath.length > 40 
            ? '...' + project.rootPath.slice(-37) 
            : project.rootPath}
        </span>
      </div>
      
      <div className="project-card__footer">
        <span className="project-card__runtime-type">
          {project.runtime?.type || 'none'}
        </span>
        <span className="project-card__updated">
          Updated: {new Date(project.updatedAt).toLocaleDateString()}
        </span>
      </div>
      
      <div className="project-card__actions">
        <button 
          className="btn-secondary"
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Open project settings
          }}
        >
          Settings
        </button>
        <button 
          className="btn-danger"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete project "${project.name}"?`)) {
              onDelete(project.id);
            }
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

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
  isLoading 
}) => {
  const [formData, setFormData] = useState<CreateProjectFormData>({
    name: '',
    rootPath: '',
    description: '',
    runtimeType: 'none',
    dockerImage: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Project</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Project Name *</label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My Awesome Project"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="rootPath">Project Path *</label>
            <input
              id="rootPath"
              type="text"
              required
              value={formData.rootPath}
              onChange={e => setFormData(prev => ({ ...prev, rootPath: e.target.value }))}
              placeholder="/path/to/project"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What is this project about?"
              rows={3}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="runtimeType">Runtime Type</label>
            <select
              id="runtimeType"
              value={formData.runtimeType}
              onChange={e => setFormData(prev => ({ ...prev, runtimeType: e.target.value }))}
            >
              <option value="none">None (Local filesystem)</option>
              <option value="process">Process (Local execution)</option>
              <option value="docker">Docker (Container isolation)</option>
            </select>
          </div>
          
          {formData.runtimeType === 'docker' && (
            <div className="form-group">
              <label htmlFor="dockerImage">Docker Image</label>
              <input
                id="dockerImage"
                type="text"
                value={formData.dockerImage}
                onChange={e => setFormData(prev => ({ ...prev, dockerImage: e.target.value }))}
                placeholder="python:3.11-slim"
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
      </div>
    </div>
  );
};

// ============= Main Page =============

const ProjectsPage: React.FC = () => {
  const {
    projects,
    currentProject,
    isLoading,
    error,
    fetchProjects,
    createProject,
    deleteProject,
    setCurrentProject,
    clearError,
  } = useProjectStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (data: CreateProjectFormData) => {
    try {
      await createProject({
        name: data.name,
        rootPath: data.rootPath,
        description: data.description,
        runtime: data.runtimeType !== 'none' ? {
          type: data.runtimeType,
          image: data.dockerImage,
        } : undefined,
      });
      setShowCreateModal(false);
    } catch (err) {
      // Error is handled by store
    }
  };

  const handleSelectProject = (id: string) => {
    const project = projects.find(p => p.id === id);
    setCurrentProject(project || null);
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProject(id);
    } catch (err) {
      // Error is handled by store
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.description?.toLowerCase().includes(filter.toLowerCase()) ||
    p.rootPath.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="projects-page">
      <header className="projects-page__header">
        <div className="projects-page__title">
          <h1>📁 Projects</h1>
          <span className="projects-page__count">{projects.length} projects</span>
        </div>
        
        <div className="projects-page__actions">
          <input
            type="search"
            placeholder="Search projects..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="search-input"
          />
          <button 
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + New Project
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}

      {isLoading && projects.length === 0 ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📂</div>
          <h2>No Projects Found</h2>
          <p>
            {filter 
              ? `No projects match "${filter}"`
              : 'Get started by creating your first project'
            }
          </p>
          {!filter && (
            <button 
              className="btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              Create Your First Project
            </button>
          )}
        </div>
      ) : (
        <div className="projects-grid">
          {filteredProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onSelect={handleSelectProject}
              onDelete={handleDeleteProject}
              isSelected={currentProject?.id === project.id}
            />
          ))}
        </div>
      )}

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
