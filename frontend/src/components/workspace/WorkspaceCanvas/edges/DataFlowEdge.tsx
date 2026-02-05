/**
 * DataFlowEdge Component
 *
 * Custom edge for data flow between sessions.
 * Shows an animated dashed line indicating active data transfer.
 */

import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

interface DataFlowEdgeData {
  lastTransfer?: string;
  transferCount?: number;
  animated?: boolean;
}

export const DataFlowEdge: React.FC<EdgeProps> = ({
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
  const data = rawData as DataFlowEdgeData | undefined;
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
          stroke: '#3b82f6',
          strokeWidth: 2,
          strokeDasharray: data?.animated ? '5 5' : 'none',
          ...style,
        }}
        className={data?.animated ? 'animated-edge' : ''}
      />
      {data?.lastTransfer && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: '#161b22',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              color: '#8b949e',
              border: '1px solid #30363d',
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            ⇄
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default DataFlowEdge;
