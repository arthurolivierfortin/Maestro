/**
 * ConnectionEdge Component
 *
 * Custom edge component for block connections.
 */

import { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import type { ConnectionEdgeData } from '../BlockCanvas/BlockCanvas';
import './ConnectionEdge.scss';

export const ConnectionEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  }: EdgeProps<ConnectionEdgeData>) => {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });

    const label = data?.label;

    return (
      <>
        <path
          id={id}
          className={`connection-edge__path ${selected ? 'connection-edge__path--selected' : ''}`}
          d={edgePath}
          strokeWidth={selected ? 3 : 2}
          stroke={selected ? '#3b82f6' : '#94a3b8'}
        />
        {label && (
          <EdgeLabelRenderer>
            <div
              className="connection-edge__label"
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              }}
            >
              {label}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  }
);

ConnectionEdge.displayName = 'ConnectionEdge';
