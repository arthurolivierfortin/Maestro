/**
 * WorkspaceInspector Component
 *
 * Displays information about a linked external workspace.
 * Shows relationship type, status, and navigation action.
 * Uses Lucide icons and Button component for consistency.
 */

import React from 'react';
import {
  Microscope,
  Dumbbell,
  Construction,
  Rocket,
  Settings,
  ArrowUp,
  Eye,
  Pencil,
  ExternalLink,
  Link,
} from 'lucide-react';
import { Button } from '../../common/Button';
import type { LinkedWorkspaceInfo, WorkspaceRelationshipType } from '../../../types/workspace-canvas.types';
import type { WorkspaceType } from '../../../types/workspace.types';
import './WorkspaceInspector.scss';

interface WorkspaceInspectorProps {
  workspace: LinkedWorkspaceInfo;
  onNavigate?: () => void;
}

const workspaceTypeColors: Record<WorkspaceType, string> = {
  Research: '#8b5cf6',
  Training: '#f59e0b',
  Staging: '#3b82f6',
  Production: '#22c55e',
  Custom: '#6b7280',
};

const WorkspaceTypeIcon: React.FC<{ type: WorkspaceType; size?: number }> = ({ type, size = 18 }) => {
  const props = { size };
  switch (type) {
    case 'Research':
      return <Microscope {...props} />;
    case 'Training':
      return <Dumbbell {...props} />;
    case 'Staging':
      return <Construction {...props} />;
    case 'Production':
      return <Rocket {...props} />;
    case 'Custom':
    default:
      return <Settings {...props} />;
  }
};

const RelationshipIcon: React.FC<{ type: WorkspaceRelationshipType; size?: number }> = ({ type, size = 16 }) => {
  const props = { size };
  switch (type) {
    case 'promotion':
      return <ArrowUp {...props} />;
    case 'read':
      return <Eye {...props} />;
    case 'write':
      return <Pencil {...props} />;
    default:
      return <Link {...props} />;
  }
};

const relationshipDescriptions: Record<WorkspaceRelationshipType, string> = {
  promotion: 'Agents can be promoted to this workspace after passing fitness thresholds.',
  read: 'This workspace can read data and blocks from the current workspace.',
  write: 'This workspace can write data to the current workspace.',
};

export const WorkspaceInspector: React.FC<WorkspaceInspectorProps> = ({
  workspace,
  onNavigate,
}) => {
  const typeColor = workspaceTypeColors[workspace.type] || '#6b7280';
  const relationDescription = relationshipDescriptions[workspace.relationshipType] || '';

  return (
    <div className="workspace-inspector">
      {/* Header */}
      <div className="workspace-inspector__header">
        <div className="workspace-inspector__title">
          <span className="workspace-inspector__icon">
            <WorkspaceTypeIcon type={workspace.type} />
          </span>
          <span className="workspace-inspector__name">Linked Workspace</span>
        </div>
        <div
          className={`workspace-inspector__status ${
            workspace.isOnline ? 'workspace-inspector__status--online' : ''
          }`}
        >
          {workspace.isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Workspace name */}
      <div className="workspace-inspector__workspace-name">
        {workspace.name}
      </div>

      {/* Type */}
      <div className="workspace-inspector__section">
        <div className="workspace-inspector__section-header">Type</div>
        <div
          className="workspace-inspector__type-badge"
          style={{ backgroundColor: `${typeColor}30`, color: typeColor }}
        >
          <WorkspaceTypeIcon type={workspace.type} size={14} />
          <span>{workspace.type}</span>
        </div>
      </div>

      {/* Relationship */}
      <div className="workspace-inspector__section">
        <div className="workspace-inspector__section-header">Relationship</div>
        <div className="workspace-inspector__relationship">
          <div className="workspace-inspector__relationship-header">
            <span className="workspace-inspector__relationship-icon">
              <RelationshipIcon type={workspace.relationshipType} />
            </span>
            <span className="workspace-inspector__relationship-type">
              {workspace.relationshipType.charAt(0).toUpperCase() + workspace.relationshipType.slice(1)}
            </span>
          </div>
          <p className="workspace-inspector__relationship-description">
            {relationDescription}
          </p>
        </div>
      </div>

      {/* Statistics */}
      {workspace.sessionCount !== undefined && (
        <div className="workspace-inspector__section">
          <div className="workspace-inspector__section-header">Statistics</div>
          <div className="workspace-inspector__stats">
            <div className="workspace-inspector__stat">
              <span className="workspace-inspector__stat-value">{workspace.sessionCount}</span>
              <span className="workspace-inspector__stat-label">Sessions</span>
            </div>
          </div>
        </div>
      )}

      {/* ID */}
      <div className="workspace-inspector__section">
        <div className="workspace-inspector__section-header">Workspace ID</div>
        <code className="workspace-inspector__id">{workspace.id}</code>
      </div>

      {/* Actions */}
      <div className="workspace-inspector__actions">
        {onNavigate && (
          <Button
            variant="primary"
            size="sm"
            icon={<ExternalLink size={14} />}
            onClick={onNavigate}
          >
            Open Workspace
          </Button>
        )}
      </div>
    </div>
  );
};

export default WorkspaceInspector;
