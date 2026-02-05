/**
 * MessageEdge Component
 *
 * Custom edge for message/event passing between sessions.
 * Shows a thin line with pulse animation for recent activity.
 */

import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

interface MessageEdgeData {
  lastTransfer?: string;
  transferCount?: number;
  animated?: boolean;
}

export const MessageEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data: rawData,
}) => {
  const data = rawData as MessageEdgeData | undefined;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: '#8b5cf6',
          strokeWidth: 1.5,
          ...style,
        }}
        className={data?.animated ? 'animated-edge pulse-edge' : ''}
      />
      {data?.transferCount !== undefined && data.transferCount > 0 && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: '#161b22',
              padding: '1px 5px',
              borderRadius: '10px',
              fontSize: '9px',
              fontWeight: 600,
              color: '#8b5cf6',
              border: '1px solid #30363d',
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            {data.transferCount}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default MessageEdge;
