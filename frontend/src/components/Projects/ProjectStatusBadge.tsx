/**
 * Project Status Badge
 *
 * Displays container status with appropriate color and animation.
 * Phase 8 implementation.
 */

import React from 'react';
import './ProjectStatusBadge.scss';

export type ContainerStatusType = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

interface ProjectStatusBadgeProps {
  status: ContainerStatusType;
  showLabel?: boolean;
}

const statusConfig: Record<ContainerStatusType, { label: string; className: string }> = {
  stopped: { label: 'Stopped', className: 'stopped' },
  starting: { label: 'Starting', className: 'starting' },
  running: { label: 'Running', className: 'running' },
  stopping: { label: 'Stopping', className: 'stopping' },
  error: { label: 'Error', className: 'error' },
};

export const ProjectStatusBadge: React.FC<ProjectStatusBadgeProps> = ({
  status,
  showLabel = true,
}) => {
  const config = statusConfig[status] || statusConfig.stopped;

  return (
    <div className={`status-badge status-badge--${config.className}`}>
      <span className="status-badge__dot" />
      {showLabel && <span className="status-badge__label">{config.label}</span>}
    </div>
  );
};

export default ProjectStatusBadge;
