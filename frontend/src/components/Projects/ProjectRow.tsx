/**
 * Project Row
 *
 * Single project row in the Docker Desktop-style list.
 * Phase 8 implementation.
 */

import React, { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Cpu, FolderOpen, Trash2 } from 'lucide-react';
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

const getRuntimeIcon = (type?: string): ReactNode => {
  switch (type) {
    case 'docker':
      return <Container size={16} />;
    case 'process':
      return <Cpu size={16} />;
    default:
      return <FolderOpen size={16} />;
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
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectRow;
