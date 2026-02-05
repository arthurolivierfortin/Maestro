/**
 * ExternalWorkspaceNode Component
 *
 * Custom React Flow node representing a linked external workspace.
 * Shows workspace type, relationship, and online status.
 * Click navigates to that workspace.
 * Uses Lucide icons for consistency.
 */

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import {
  Microscope,
  Dumbbell,
  Construction,
  Rocket,
  Settings,
  ArrowUp,
  Eye,
  Pencil,
  Link,
  ExternalLink
} from 'lucide-react';
import type { ExternalWorkspaceNodeData } from '../../../../types/workspace-canvas.types';
import type { WorkspaceType } from '../../../../types/workspace.types';
import './ExternalWorkspaceNode.scss';

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

const RelationshipIcon: React.FC<{ type: string; size?: number }> = ({ type, size = 14 }) => {
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

const relationshipLabels: Record<string, string> = {
  promotion: 'Promotes to',
  read: 'Reads from',
  write: 'Writes to',
};

export const ExternalWorkspaceNode: React.FC<NodeProps<ExternalWorkspaceNodeData>> = memo(
  ({ data, selected }) => {
    const typeColor = workspaceTypeColors[data.type] || '#6b7280';
    const relationLabel = relationshipLabels[data.relationshipType] || data.relationshipType;

    return (
      <div
        className={`external-workspace-node ${selected ? 'external-workspace-node--selected' : ''} ${
          !data.isOnline ? 'external-workspace-node--offline' : ''
        }`}
        style={{ '--type-color': typeColor } as React.CSSProperties}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="external-workspace-node__handle"
        />

        {/* Header */}
        <div className="external-workspace-node__header">
          <span className="external-workspace-node__icon">
            <WorkspaceTypeIcon type={data.type} />
          </span>
          <span className="external-workspace-node__name" title={data.name}>
            {data.name}
          </span>
          <span
            className={`external-workspace-node__status ${
              data.isOnline ? 'external-workspace-node__status--online' : ''
            }`}
          />
        </div>

        {/* Metadata */}
        <div className="external-workspace-node__meta">
          <span className="external-workspace-node__type">{data.type}</span>
          {data.sessionCount !== undefined && (
            <span className="external-workspace-node__sessions">
              {data.sessionCount} sessions
            </span>
          )}
        </div>

        {/* Relationship badge */}
        <div className="external-workspace-node__relationship">
          <span className="external-workspace-node__relation-icon">
            <RelationshipIcon type={data.relationshipType} />
          </span>
          <span className="external-workspace-node__relation-label">{relationLabel}</span>
        </div>

        {/* External link indicator */}
        <div className="external-workspace-node__link-hint">
          <ExternalLink size={12} />
          <span>Click to open workspace</span>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="external-workspace-node__handle"
        />
      </div>
    );
  }
);

ExternalWorkspaceNode.displayName = 'ExternalWorkspaceNode';

export default ExternalWorkspaceNode;
