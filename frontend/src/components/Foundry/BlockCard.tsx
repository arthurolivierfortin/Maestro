/**
 * Block Card Component
 *
 * Displays a single block with hover actions.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Edit, Copy, Trash2 } from 'lucide-react';
import { BlockIcon } from '../icons';
import type { Block } from '../../types/block.types';
import { useBlockStore } from '../../store';
import './BlockCard.scss';

interface BlockCardProps {
  block: Block;
}

export function BlockCard({ block }: BlockCardProps) {
  const navigate = useNavigate();
  const [showActions, setShowActions] = useState(false);
  const { duplicateBlock, removeBlock } = useBlockStore();

  /**
   * Handle card click - navigate to block detail or canvas
   */
  const handleClick = () => {
    if (block.isAtomic) {
      navigate(`/foundry/${block.id}/edit`);
    } else {
      navigate(`/canvas/${block.id}`);
    }
  };

  /**
   * Handle edit action
   */
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleClick();
  };

  /**
   * Handle duplicate action
   */
  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateBlock(block.id);
  };

  /**
   * Handle delete action
   */
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${block.name}"?`)) {
      removeBlock(block.id);
    }
  };

  /**
   * Toggle actions menu
   */
  const handleToggleActions = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(!showActions);
  };

  /**
   * Get status badge color
   */
  const getStatusColor = () => {
    switch (block.metadata.status) {
      case 'active':
        return 'success';
      case 'draft':
        return 'warning';
      case 'archived':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  return (
    <div
      className="block-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${block.name} - ${block.blockType}`}
    >
      {/* Card header */}
      <div className="block-card__header">
        <div className="block-card__icon-wrapper">
          <BlockIcon type={block.blockType} size={32} className="block-card__icon" />
        </div>

        <button
          className="block-card__actions-toggle"
          onClick={handleToggleActions}
          aria-label="More actions"
        >
          <MoreVertical size={16} />
        </button>

        {showActions && (
          <div className="block-card__actions">
            <button className="block-card__action" onClick={handleEdit} aria-label="Edit">
              <Edit size={16} />
              <span>Edit</span>
            </button>
            <button className="block-card__action" onClick={handleDuplicate} aria-label="Duplicate">
              <Copy size={16} />
              <span>Duplicate</span>
            </button>
            <button
              className="block-card__action block-card__action--danger"
              onClick={handleDelete}
              aria-label="Delete"
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="block-card__body">
        <h3 className="block-card__name">{block.name}</h3>

        {block.metadata.description && (
          <p className="block-card__description">{block.metadata.description}</p>
        )}

        <div className="block-card__meta">
          <span className={`block-card__badge block-card__badge--${block.blockType}`}>
            {block.blockType}
          </span>

          {!block.isAtomic && (
            <span className="block-card__badge block-card__badge--composite" title="Composite block">
              ⊞ Composite
            </span>
          )}

          <span className={`block-card__badge block-card__badge--${getStatusColor()}`}>
            {block.metadata.status}
          </span>
        </div>

        {/* Tags */}
        {block.metadata.tags.length > 0 && (
          <div className="block-card__tags">
            {block.metadata.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="block-card__tag">
                {tag}
              </span>
            ))}
            {block.metadata.tags.length > 3 && (
              <span className="block-card__tag">+{block.metadata.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Capabilities */}
        {block.capabilities && block.capabilities.length > 0 && (
          <div className="block-card__capabilities">
            {block.capabilities.slice(0, 2).map((capability) => (
              <span key={capability} className="block-card__capability">
                {capability}
              </span>
            ))}
            {block.capabilities.length > 2 && (
              <span className="block-card__capability">+{block.capabilities.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
