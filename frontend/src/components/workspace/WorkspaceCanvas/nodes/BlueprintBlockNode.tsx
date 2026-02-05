/**
 * BlueprintBlockNode Component
 *
 * Custom React Flow node for displaying blocks in blueprint view.
 * Shows block type, name, entry point status, and child count.
 */

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { BlockIcon, blockColorMap } from '../../../icons';
import type { BlueprintBlockNodeData, EntryPointType } from '../../../../types/workspace-canvas.types';
import type { BlockType } from '../../../../types/block.types';
import './BlueprintBlockNode.scss';

const entryPointLabels: Record<EntryPointType, string> = {
  main: 'Main',
  dashboard: 'Dashboard',
  experiments: 'Experiments',
  settings: 'Settings',
  custom: 'Custom',
};

const entryPointColors: Record<EntryPointType, string> = {
  main: '#f59e0b', // Golden/amber
  dashboard: '#3b82f6',
  experiments: '#8b5cf6',
  settings: '#6b7280',
  custom: '#10b981',
};

export const BlueprintBlockNode: React.FC<NodeProps<BlueprintBlockNodeData>> = memo(
  ({ data, selected }) => {
    const blockColor = blockColorMap[data.blockType as BlockType] || '#6b7280';
    const isEntryMain = data.isEntryPoint && data.entryPointType === 'main';
    // Entry point nodes (left side) need right handle as source
    const isEntryPointNode = data.isEntryPoint && data.entryPointType;

    return (
      <div
        className={`blueprint-node ${selected ? 'blueprint-node--selected' : ''} ${
          isEntryMain ? 'blueprint-node--main-entry' : ''
        } ${isEntryPointNode ? 'blueprint-node--entry-point' : ''}`}
        style={{ '--block-color': blockColor } as React.CSSProperties}
      >
        {/* Top handle for parent-child edges */}
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className="blueprint-node__handle"
        />
        {/* Left handle for entry point arrows */}
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="blueprint-node__handle blueprint-node__handle--left"
        />

        {/* Entry Point Badge */}
        {data.isEntryPoint && data.entryPointType && (
          <div
            className="blueprint-node__entry-badge"
            style={{
              backgroundColor: entryPointColors[data.entryPointType],
            }}
          >
            {entryPointLabels[data.entryPointType]}
          </div>
        )}

        {/* Main Content */}
        <div className="blueprint-node__content">
          {/* Icon and Name Row */}
          <div className="blueprint-node__header">
            <div className="blueprint-node__icon">
              <BlockIcon type={data.blockType as BlockType} size={20} />
            </div>
            <span className="blueprint-node__name" title={data.name}>
              {data.name}
            </span>
          </div>

          {/* Type Badge and Meta Row */}
          <div className="blueprint-node__meta">
            <span
              className="blueprint-node__type-badge"
              style={{ backgroundColor: blockColor }}
            >
              {data.blockType}
            </span>
            {!data.isAtomic && data.childCount !== undefined && data.childCount > 0 && (
              <span className="blueprint-node__child-count">
                {data.childCount} {data.childCount === 1 ? 'child' : 'children'}
              </span>
            )}
            {data.isAtomic && (
              <span className="blueprint-node__atomic-badge">atomic</span>
            )}
          </div>
        </div>

        {/* Bottom handle for parent-child edges */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="blueprint-node__handle"
        />
        {/* Right handle for entry point arrows (source) */}
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="blueprint-node__handle blueprint-node__handle--right"
        />
      </div>
    );
  }
);

BlueprintBlockNode.displayName = 'BlueprintBlockNode';

export default BlueprintBlockNode;
