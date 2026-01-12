/**
 * BaseBlockNode Component
 *
 * Base node component for all block types on the canvas.
 */

import { memo, useCallback, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { MoreVertical } from 'lucide-react';
import { BlockIcon } from '../icons/BlockIcons';
import { NodeContextMenu } from '../NodeContextMenu';
import { useBlockStore } from '../../store/blockStore';
import { useNavigationStore } from '../../store/navigationStore';
import type { Block } from '../../types/block.types';
import {
  isAgentConfig,
  isTaskConfig,
  isPromptConfig,
  isDecisionConfig,
  isToolConfig,
  isValidatorConfig,
  isTriggerConfig,
  isInstructionConfig,
  isWorkflowConfig,
} from '../../types/block.types';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const { duplicateBlock, removeBlock } = useBlockStore();
  const { selectBlock, setPropertiesPanelMode } = useNavigationStore();

  // Handle double-click to drill down into composite blocks
  const handleDoubleClick = useCallback(() => {
    console.log('[BaseBlockNode] Double-click on block:', {
      blockId: block.id,
      blockName: block.name,
      isAtomic: block.isAtomic,
      hasChildren: block.children && block.children.length > 0,
    });
    
    // Allow drill-down into any composite (non-atomic) block, even if empty
    if (!block.isAtomic) {
      console.log('[BaseBlockNode] Drilling down into composite block');
      onDrillDown(block.id);
    } else {
      console.log('[BaseBlockNode] Block is atomic - no drill down');
    }
  }, [block, onDrillDown]);

  // Handle menu click
  const handleMenuClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setMenuOpen(!menuOpen);
    },
    [menuOpen]
  );

  // Context menu actions
  const handleEdit = useCallback(() => {
    console.log('[BaseBlockNode Menu] Edit action clicked for block:', block.id);
    selectBlock(block.id);
    setPropertiesPanelMode('edit');
  }, [block.id, selectBlock, setPropertiesPanelMode]);

  const handleDuplicate = useCallback(() => {
    console.log('[BaseBlockNode Menu] Duplicate action clicked for block:', block.id);
    duplicateBlock(block.id);
  }, [block.id, duplicateBlock]);

  const handleDelete = useCallback(() => {
    console.log('[BaseBlockNode Menu] Delete action clicked for block:', block.id);
    removeBlock(block.id);
  }, [block.id, removeBlock]);

  const handleDrillIntoMenu = useCallback(() => {
    console.log('[BaseBlockNode Menu] Drill into action clicked for block:', block.id);
    onDrillDown(block.id);
  }, [block.id, onDrillDown]);

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
        <button
          className="base-block-node__menu"
          onClick={handleMenuClick}
          aria-label="Block menu"
          title="Block menu"
        >
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

      {/* Context Menu */}
      {menuOpen && (
        <NodeContextMenu
          block={block}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onDrillInto={hasChildren ? handleDrillIntoMenu : undefined}
          onClose={() => setMenuOpen(false)}
        />
      )}
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
      if (isAgentConfig(block.config)) {
        return (
          <div className="base-block-node__preview">
            <div className="base-block-node__preview-label">Agent Type:</div>
            <div className="base-block-node__preview-value">
              {block.config.agentType || 'Custom'}
            </div>
            {block.config.model && (
              <>
                <div className="base-block-node__preview-label">Model:</div>
                <div className="base-block-node__preview-value">{block.config.model}</div>
              </>
            )}
          </div>
        );
      }
      return null;

    case 'task':
      if (isTaskConfig(block.config)) {
        return (
          <div className="base-block-node__preview">
            <div className="base-block-node__preview-text">
              {block.config.description || 'No description'}
            </div>
          </div>
        );
      }
      return null;

    case 'prompt':
      if (isPromptConfig(block.config)) {
        return (
          <div className="base-block-node__preview">
            <div className="base-block-node__preview-text">
              {block.config.template ? truncate(block.config.template, 50) : 'No template'}
            </div>
          </div>
        );
      }
      return null;

    case 'decision':
      if (isDecisionConfig(block.config)) {
        return (
          <div className="base-block-node__preview">
            <div className="base-block-node__preview-label">Condition:</div>
            <div className="base-block-node__preview-text">
              {block.config.condition || 'No condition'}
            </div>
          </div>
        );
      }
      return null;

    case 'tool':
      if (isToolConfig(block.config)) {
        return (
          <div className="base-block-node__preview">
            <div className="base-block-node__preview-label">Tool Type:</div>
            <div className="base-block-node__preview-value">
              {block.config.toolType || 'Custom'}
            </div>
          </div>
        );
      }
      return null;

    case 'validator':
      if (isValidatorConfig(block.config)) {
        return (
          <div className="base-block-node__preview">
            <div className="base-block-node__preview-label">Type:</div>
            <div className="base-block-node__preview-value">
              {block.config.validationType || 'Schema'}
            </div>
          </div>
        );
      }
      return null;

    case 'trigger':
      if (isTriggerConfig(block.config)) {
        return (
          <div className="base-block-node__preview">
            <div className="base-block-node__preview-label">Trigger Type:</div>
            <div className="base-block-node__preview-value">
              {block.config.triggerType || 'Manual'}
            </div>
          </div>
        );
      }
      return null;

    case 'instruction':
      if (isInstructionConfig(block.config)) {
        return (
          <div className="base-block-node__preview">
            <div className="base-block-node__preview-text">
              {block.config.filePath || 'No file selected'}
            </div>
          </div>
        );
      }
      return null;

    case 'workflow':
      if (isWorkflowConfig(block.config)) {
        return (
          <div className="base-block-node__preview">
            <div className="base-block-node__preview-text">
              {block.config.description || 'Workflow container'}
            </div>
          </div>
        );
      }
      return null;

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
