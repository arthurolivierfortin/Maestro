/**
 * SessionNode Component
 *
 * Custom React Flow node representing a session on the workspace canvas.
 * Displays session status, block count, progress, and provides drill-down interaction.
 * Uses Lucide icons for consistency with the rest of the app.
 */

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Play, Pause, Clock, CheckCircle, XCircle, StopCircle } from 'lucide-react';
import { BlockIcon } from '../../../icons';
import type { SessionNodeData } from '../../../../types/workspace-canvas.types';
import type { SessionStatus } from '../../../../types/session.types';
import type { BlockType } from '../../../../types/block.types';
import './SessionNode.scss';

const statusColors: Record<SessionStatus, string> = {
  Running: '#3b82f6',
  Pending: '#8b5cf6',
  Paused: '#f59e0b',
  Completed: '#22c55e',
  Failed: '#ef4444',
  Cancelled: '#6b7280',
};

const StatusIcon: React.FC<{ status: SessionStatus; size?: number }> = ({ status, size = 14 }) => {
  const props = { size, className: `session-node__status-icon--${status.toLowerCase()}` };

  switch (status) {
    case 'Running':
      return <Play {...props} />;
    case 'Pending':
      return <Clock {...props} />;
    case 'Paused':
      return <Pause {...props} />;
    case 'Completed':
      return <CheckCircle {...props} />;
    case 'Failed':
      return <XCircle {...props} />;
    case 'Cancelled':
      return <StopCircle {...props} />;
    default:
      return <Clock {...props} />;
  }
};

function formatDuration(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);

  if (diffMins >= 60) {
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  }
  if (diffMins > 0) {
    return `${diffMins}m ${diffSecs}s`;
  }
  return `${diffSecs}s`;
}

export const SessionNode: React.FC<NodeProps<SessionNodeData>> = memo(
  ({ data, selected }) => {
    const statusColor = statusColors[data.status] || '#6b7280';

    const progressPercent = data.progress
      ? Math.round((data.progress.current / data.progress.total) * 100)
      : null;

    return (
      <div
        className={`session-node ${selected ? 'session-node--selected' : ''}`}
        style={{ '--status-color': statusColor } as React.CSSProperties}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="session-node__handle"
        />

        {/* Header */}
        <div className="session-node__header">
          <StatusIcon status={data.status} />
          <span className="session-node__name" title={data.name}>
            {data.name}
          </span>
          <span
            className="session-node__status-badge"
            style={{ backgroundColor: statusColor }}
          >
            {data.status}
          </span>
        </div>

        {/* Metadata */}
        <div className="session-node__meta">
          <span className="session-node__type">{data.type}</span>
          <span className="session-node__blocks">
            {data.activeBlockCount}/{data.blockCount} blocks
          </span>
        </div>

        {/* Block previews - using Lucide BlockIcon */}
        {data.blockPreviews && data.blockPreviews.length > 0 && (
          <div className="session-node__block-previews">
            {data.blockPreviews.slice(0, 5).map((block) => (
              <div
                key={block.id}
                className="session-node__block-icon"
                title={`${block.name} (${block.type})`}
              >
                <BlockIcon type={block.type as BlockType} size={16} />
              </div>
            ))}
            {data.blockPreviews.length > 5 && (
              <div className="session-node__block-more">
                +{data.blockPreviews.length - 5}
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        {data.progress && progressPercent !== null && (
          <div className="session-node__progress">
            <div
              className="session-node__progress-bar"
              style={{ width: `${progressPercent}%` }}
            />
            <span className="session-node__progress-label">
              {data.progress.label || `${data.progress.current}/${data.progress.total}`}
            </span>
          </div>
        )}

        {/* Status bar */}
        <div className="session-node__status-bar">
          {data.startedAt && data.status === 'Running' && (
            <span className="session-node__duration">
              Running for {formatDuration(data.startedAt)}
            </span>
          )}
          {data.metrics && (
            <span className="session-node__metrics">
              {data.metrics.errorsCount > 0 && (
                <span className="session-node__errors">
                  {data.metrics.errorsCount} errors
                </span>
              )}
            </span>
          )}
        </div>

        {/* Drill-down hint */}
        <div className="session-node__hint">Double-click to inspect</div>

        <Handle
          type="source"
          position={Position.Right}
          className="session-node__handle"
        />
      </div>
    );
  }
);

SessionNode.displayName = 'SessionNode';

export default SessionNode;
