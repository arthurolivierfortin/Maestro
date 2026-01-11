/**
 * Block Card
 *
 * Visual card representation of a block in the grid.
 * Phase 4f.2 - Foundry Page Foundation
 */

import { useState } from 'react';
import { useBlockStore } from '../../store/blockStore';
import type { Block } from '../../types/block.types';
import './BlockCard.scss';

interface BlockCardProps {
  block: Block;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

const BLOCK_ICONS: Record<string, string> = {
  workflow: '🔀',
  agent: '🤖',
  task: '📋',
  tool: '🔧',
  prompt: '📝',
  instruction: '📄',
  decision: '❓',
  validator: '✅',
  trigger: '⚡',
};

export function BlockCard({ block, isSelected, onClick, onDoubleClick }: BlockCardProps) {
  const [showActions, setShowActions] = useState(false);
  const { duplicateBlock, removeBlock } = useBlockStore();

  const icon = BLOCK_ICONS[block.blockType] || '📦';
  const status = block.metadata.status || 'active';

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateBlock(block.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${block.name}"?`)) {
      removeBlock(block.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Edit block:', block.id);
    // TODO: Navigate to edit view
  };

  return (
    <div
      className={`block-card ${isSelected ? 'selected' : ''} ${status}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick();
        if (e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="card-header">
        <span className="block-icon">{icon}</span>
        {!block.isAtomic && <span className="composite-indicator" title="Composite block">⚙️</span>}
      </div>

      <div className="card-body">
        <h4 className="block-name">{block.name}</h4>
        <span className="block-type-badge">{block.blockType}</span>
      </div>

      {block.metadata.tags && block.metadata.tags.length > 0 && (
        <div className="card-tags">
          {block.metadata.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
          {block.metadata.tags.length > 3 && (
            <span className="tag-more">+{block.metadata.tags.length - 3}</span>
          )}
        </div>
      )}

      {status !== 'active' && (
        <div className="status-badge">
          {status === 'draft' && '📝 Draft'}
          {status === 'archived' && '📦 Archived'}
        </div>
      )}

      {showActions && (
        <div className="card-actions">
          <button
            className="action-btn"
            onClick={handleEdit}
            title="Edit"
            aria-label="Edit block"
          >
            ✏️
          </button>
          <button
            className="action-btn"
            onClick={handleDuplicate}
            title="Duplicate"
            aria-label="Duplicate block"
          >
            📋
          </button>
          <button
            className="action-btn delete"
            onClick={handleDelete}
            title="Delete"
            aria-label="Delete block"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}
