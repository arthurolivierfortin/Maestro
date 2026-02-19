/**
 * PromotionEdge Component
 *
 * Custom edge for workspace promotion relationships.
 * Shows a thick animated line with arrow indicating promotion direction.
 */

import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

interface PromotionEdgeData {
  lastTransfer?: string;
  transferCount?: number;
  animated?: boolean;
}

export const PromotionEdge: React.FC<EdgeProps> = ({
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
  const data = rawData as PromotionEdgeData | undefined;
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
          stroke: '#22c55e',
          strokeWidth: 3,
          ...style,
        }}
        className={data?.animated ? 'animated-edge' : ''}
      />
      {data?.transferCount !== undefined && data.transferCount > 0 && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: '#161b22',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 500,
              color: '#22c55e',
              border: '1px solid #30363d',
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            ↑ {data.transferCount}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default PromotionEdge;
