/**
 * BlueprintEdge Component
 *
 * Custom edge for blueprint view showing parent-child relationships.
 * Uses a simple straight or bezier path with optional dashed styling.
 */

import React from 'react';
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from 'reactflow';

interface BlueprintEdgeData {
  isChildRelation?: boolean;
  isOptional?: boolean;
}

export const BlueprintEdge: React.FC<EdgeProps> = ({
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
  const data = rawData as BlueprintEdgeData | undefined;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const isOptional = data?.isOptional;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: '#4a5568',
        strokeWidth: 2,
        strokeDasharray: isOptional ? '6 4' : 'none',
        ...style,
      }}
    />
  );
};

export default BlueprintEdge;
