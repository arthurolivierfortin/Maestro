/**
 * Block Card Component
 *
 * Displays a single block with hover actions.
 */

import { useState } from 'react';
import { MoreVertical, Edit, Copy, Trash2, Star, Play } from 'lucide-react';
import { BlockIcon } from '../icons';
import type { Block } from '../../types/block.types';
import { useBlockStore } from '../../store';
import { useNavigation } from '../../hooks/useNavigation';
import { useFavorites } from '../../hooks/useFavorites';
import { ExecutionModal } from '../Execution/ExecutionModal';
import './BlockCard.scss';

interface BlockCardProps {
  block: Block;
}

export function BlockCard({ block }: BlockCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  // Use individual selectors to prevent re-renders on unrelated state changes
  const duplicateBlock = useBlockStore((s) => s.duplicateBlock);
  const removeBlock = useBlockStore((s) => s.removeBlock);
  const { toggleFavorite, isFavorite } = useFavorites();
  const { navigateToBlock } = useNavigation();

  // Check if block is executable (tool or workflow)
  const isExecutable = ['tool', 'workflow'].includes(block.blockType.toLowerCase());

  /**
   * Handle card click - navigate to block detail or canvas
   * Uses unified navigation: atomic -> edit page, non-atomic -> canvas
   */
  const handleClick = () => {
    navigateToBlock(block.id);
  };

  /**
   * Handle favorite toggle
   */
  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(block.id);
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
   * Handle execute action
   */
  const handleExecute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(false);
    setShowExecuteModal(true);
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

        <div className="block-card__actions-bar">
          <button
            className={`block-card__favorite ${isFavorite(block.id) ? 'block-card__favorite--active' : ''}`}
            onClick={handleFavoriteToggle}
            aria-label={isFavorite(block.id) ? 'Remove from favorites' : 'Add to favorites'}
            title={isFavorite(block.id) ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={16} fill={isFavorite(block.id) ? 'currentColor' : 'none'} />
          </button>

          <button
            className="block-card__actions-toggle"
            onClick={handleToggleActions}
            aria-label="More actions"
          >
            <MoreVertical size={16} />
          </button>
        </div>

        {showActions && (
          <div className="block-card__actions">
            {isExecutable && (
              <button className="block-card__action block-card__action--execute" onClick={handleExecute} aria-label="Execute">
                <Play size={16} />
                <span>Execute</span>
              </button>
            )}
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
            <span
              className="block-card__badge block-card__badge--composite"
              title="Composite block"
            >
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

      {/* Execution Modal */}
      <ExecutionModal
        isOpen={showExecuteModal}
        onClose={() => setShowExecuteModal(false)}
        blockId={block.id}
        blockName={block.name}
        blockType={block.blockType}
        isWorkflow={block.blockType.toLowerCase() === 'workflow'}
      />
    </div>
  );
}
