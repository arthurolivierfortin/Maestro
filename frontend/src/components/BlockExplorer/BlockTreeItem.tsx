/**
 * BlockTreeItem Component
 *
 * Recursive tree item for block hierarchy.
 */

import { useState } from 'react';
import { useNavigation } from '../../hooks';
import { BlockIcon, ChevronIcon } from '../icons';
import type { Block } from '../../types/block.types';
import './BlockTreeItem.scss';

interface BlockTreeItemProps {
  block: Block;
  level?: number;
  onContextMenu?: (block: Block, event: React.MouseEvent) => void;
}

export function BlockTreeItem({ block, level = 0, onContextMenu }: BlockTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { navigateInto, currentPath, selectBlock, selectedBlockId, enterAtomicBlockEdit } =
    useNavigation();

  const hasChildren = block.children && block.children.length > 0;
  const isInPath = currentPath.includes(block.id);
  const isSelected = selectedBlockId === block.id;

  const handleClick = () => {
    selectBlock(block.id);
  };

  const handleDoubleClick = () => {
    if (block.isAtomic) {
      // Enter edit mode for atomic blocks
      enterAtomicBlockEdit(block.id);
    } else if (hasChildren) {
      // Drill down into composite blocks
      navigateInto(block.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(block, e);
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="block-tree-item">
      <div
        className={`block-tree-item__content ${isSelected ? 'block-tree-item__content--selected' : ''} ${isInPath ? 'block-tree-item__content--in-path' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        aria-label={block.name}
        aria-expanded={hasChildren ? isExpanded : undefined}
      >
        {hasChildren ? (
          <button
            className="block-tree-item__expand"
            onClick={toggleExpand}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronIcon isExpanded={isExpanded} size={14} />
          </button>
        ) : (
          <span className="block-tree-item__spacer" />
        )}

        <BlockIcon type={block.blockType} size={16} className="block-tree-item__icon" />

        <span className="block-tree-item__name">{block.name}</span>

        {!block.isAtomic && (
          <span className="block-tree-item__badge" title="Composite block">
            ⊞
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="block-tree-item__children">
          {block.children!.map((child) => (
            <BlockTreeItem
              key={child.id}
              block={child}
              level={level + 1}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}
