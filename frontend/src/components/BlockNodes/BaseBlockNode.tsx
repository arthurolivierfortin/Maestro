/**
 * BaseBlockNode Component
 *
 * Base node component for all block types on the canvas.
 */

import { memo, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { MoreVertical } from 'lucide-react';
import { BlockIcon } from '../icons/BlockIcons';
import type { Block } from '../../types/block.types';
import type { BlockNodeData } from '../BlockCanvas/BlockCanvas';
import './BaseBlockNode.scss';

export interface BaseBlockNodeProps {
  data: BlockNodeData;
  selected: boolean;
}

/**
 * BaseBlockNode Component
 */
export const BaseBlockNode = memo(({ data, selected }: BaseBlockNodeProps) => {
  const { block, isExecuting, executionStatus, onDrillDown } = data;

  // Handle double-click to drill down into composite blocks
  const handleDoubleClick = useCallback(() => {
    if (!block.isAtomic && block.children && block.children.length > 0) {
      onDrillDown(block.id);
    }
  }, [block, onDrillDown]);

  // Determine status class
  const statusClass = executionStatus
    ? `base-block-node--${executionStatus}`
    : isExecuting
      ? 'base-block-node--executing'
      : '';

  // Show composite indicator if block has children
  const hasChildren = !block.isAtomic && block.children && block.children.length > 0;

  return (
    <div
      className={`base-block-node base-block-node--${block.blockType} ${statusClass} ${selected ? 'selected' : ''}`}
      onDoubleClick={handleDoubleClick}
    >
      {/* Input Handles */}
      {block.inputs.map((input, index) => (
        <Handle
          key={input.id}
          type="target"
          position={Position.Left}
          id={input.id}
          style={{ top: `${((index + 1) * 100) / (block.inputs.length + 1)}%` }}
          className="base-block-node__handle base-block-node__handle--input"
        />
      ))}

      {/* Header */}
      <div className="base-block-node__header">
        <BlockIcon type={block.blockType} size={16} className="base-block-node__icon" />
        <span className="base-block-node__name">{block.name}</span>
        <button className="base-block-node__menu" aria-label="Block menu">
          <MoreVertical size={14} />
        </button>
      </div>

      {/* Content - Type-specific preview */}
      <div className="base-block-node__content">
        {renderBlockContent(block)}
        {hasChildren && (
          <div className="base-block-node__composite-badge">
            {block.children!.length} block{block.children!.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Status Indicator */}
      {executionStatus && (
        <div className={`base-block-node__status base-block-node__status--${executionStatus}`}>
          {executionStatus}
        </div>
      )}

      {/* Output Handles */}
      {block.outputs.map((output, index) => (
        <Handle
          key={output.id}
          type="source"
          position={Position.Right}
          id={output.id}
          style={{ top: `${((index + 1) * 100) / (block.outputs.length + 1)}%` }}
          className="base-block-node__handle base-block-node__handle--output"
        />
      ))}
    </div>
  );
});

BaseBlockNode.displayName = 'BaseBlockNode';

/**
 * Render type-specific content
 */
function renderBlockContent(block: Block) {
  switch (block.blockType) {
    case 'agent':
      return (
        <div className="base-block-node__preview">
          <div className="base-block-node__preview-label">Agent Type:</div>
          <div className="base-block-node__preview-value">{block.config.agentType || 'Custom'}</div>
          {block.config.model && (
            <>
              <div className="base-block-node__preview-label">Model:</div>
              <div className="base-block-node__preview-value">{block.config.model}</div>
            </>
          )}
        </div>
      );

    case 'task':
      return (
        <div className="base-block-node__preview">
          <div className="base-block-node__preview-text">
            {block.config.description || 'No description'}
          </div>
        </div>
      );

    case 'prompt':
      return (
        <div className="base-block-node__preview">
          <div className="base-block-node__preview-text">
            {block.config.template ? truncate(block.config.template, 50) : 'No template'}
          </div>
        </div>
      );

    case 'decision':
      return (
        <div className="base-block-node__preview">
          <div className="base-block-node__preview-label">Condition:</div>
          <div className="base-block-node__preview-text">
            {block.config.condition || 'No condition'}
          </div>
        </div>
      );

    case 'tool':
      return (
        <div className="base-block-node__preview">
          <div className="base-block-node__preview-label">Tool Type:</div>
          <div className="base-block-node__preview-value">{block.config.toolType || 'Custom'}</div>
        </div>
      );

    case 'validator':
      return (
        <div className="base-block-node__preview">
          <div className="base-block-node__preview-label">Type:</div>
          <div className="base-block-node__preview-value">
            {block.config.validationType || 'Schema'}
          </div>
        </div>
      );

    case 'trigger':
      return (
        <div className="base-block-node__preview">
          <div className="base-block-node__preview-label">Trigger Type:</div>
          <div className="base-block-node__preview-value">
            {block.config.triggerType || 'Manual'}
          </div>
        </div>
      );

    case 'instruction':
      return (
        <div className="base-block-node__preview">
          <div className="base-block-node__preview-text">
            {block.config.filePath || 'No file selected'}
          </div>
        </div>
      );

    case 'workflow':
      return (
        <div className="base-block-node__preview">
          <div className="base-block-node__preview-text">
            {block.config.description || 'Workflow container'}
          </div>
        </div>
      );

    default:
      return null;
  }
}

/**
 * Truncate text to a maximum length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
