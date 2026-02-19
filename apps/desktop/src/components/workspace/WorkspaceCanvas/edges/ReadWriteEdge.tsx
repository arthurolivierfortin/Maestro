/**
 * ReadWriteEdge Component
 *
 * Custom edge for read/write relationships between workspaces.
 * Shows direction of data access with different colors for read vs write.
 */

import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

interface ReadWriteEdgeData {
  relationshipType: 'read' | 'write';
  lastTransfer?: string;
  transferCount?: number;
  animated?: boolean;
}

export const ReadWriteEdge: React.FC<EdgeProps> = ({
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
  const data = rawData as ReadWriteEdgeData | undefined;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isWrite = data?.relationshipType === 'write';
  const color = isWrite ? '#f59e0b' : '#6b7280';
  const icon = isWrite ? '✎' : '☰';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: '3 3',
          ...style,
        }}
        className={data?.animated ? 'animated-edge' : ''}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: '#161b22',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            color: color,
            border: '1px solid #30363d',
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {icon} {data?.relationshipType}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default ReadWriteEdge;
