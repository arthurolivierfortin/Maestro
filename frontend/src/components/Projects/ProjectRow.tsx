/**
 * Project Row
 *
 * Single project row in the Docker Desktop-style list.
 * Phase 8 implementation.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '../../store/projectStore';
import { ContainerState } from '../../services/containerService';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import { ContainerControls } from './ContainerControls';
import './ProjectRow.scss';

interface ProjectRowProps {
  project: Project;
  containerState?: ContainerState;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onDelete: (id: string) => void;
}

const getRuntimeIcon = (type?: string): string => {
  switch (type) {
    case 'docker':
      return '🐳';
    case 'process':
      return '⚡';
    default:
      return '📁';
  }
};

const formatTimeAgo = (date: string): string => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
};

export const ProjectRow: React.FC<ProjectRowProps> = ({
  project,
  containerState,
  onStart,
  onStop,
  onRestart,
  onDelete,
}) => {
  const navigate = useNavigate();
  const status = containerState?.status || 'stopped';
  const hasRuntime = project.runtime?.type !== undefined && project.runtime.type !== 'none';

  const handleClick = () => {
    navigate(`/projects/${project.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete project "${project.name}"?`)) {
      onDelete(project.id);
    }
  };

  return (
    <div className="project-row" onClick={handleClick}>
      {/* Status indicator */}
      <div className="project-row__status-indicator">
        <div className={`project-row__status-dot project-row__status-dot--${status}`} />
      </div>

      {/* Main content */}
      <div className="project-row__content">
        <div className="project-row__header">
          <span className="project-row__runtime-icon">{getRuntimeIcon(project.runtime?.type)}</span>
          <h3 className="project-row__name">{project.name}</h3>
          <ProjectStatusBadge status={status} />
        </div>

        <div className="project-row__details">
          <span className="project-row__path" title={project.rootPath}>
            {project.rootPath}
          </span>
          {containerState?.startedAt && status === 'running' && (
            <span className="project-row__uptime">
              Started {formatTimeAgo(containerState.startedAt)}
            </span>
          )}
          {status === 'stopped' && (
            <span className="project-row__updated">
              Updated {formatTimeAgo(project.updatedAt)}
            </span>
          )}
        </div>

        {/* Resource usage for running containers */}
        {status === 'running' && containerState?.resourceUsage && (
          <div className="project-row__resources">
            <span>CPU: {containerState.resourceUsage.cpuPercent.toFixed(1)}%</span>
            <span>Memory: {containerState.resourceUsage.memoryMb.toFixed(0)}MB</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="project-row__controls">
        <ContainerControls
          status={status}
          hasRuntime={hasRuntime}
          onStart={() => onStart(project.id)}
          onStop={() => onStop(project.id)}
          onRestart={() => onRestart(project.id)}
          compact
        />

        {/* More actions menu */}
        <div className="project-row__actions">
          <button
            className="project-row__action-btn"
            onClick={handleDeleteClick}
            title="Delete project"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
              <path
                fillRule="evenodd"
                d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectRow;
