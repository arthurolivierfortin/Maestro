/**
 * BlockExplorer Component
 *
 * Main sidebar component showing block hierarchy.
 * Replaces the original Sidebar component.
 */

import { useState } from 'react';
import { useBlockActions } from '../../hooks';
import { BlockTreeItem } from './BlockTreeItem';
import { BlockContextMenu } from './BlockContextMenu';
import type { Block } from '../../types/block.types';
import './BlockExplorer.scss';

interface BlockExplorerProps {
  contextBlockId?: string | null;
}

export function BlockExplorer({ contextBlockId }: BlockExplorerProps = {}) {
  const { getRootBlock, getBlock, removeBlock, duplicateBlock, renameBlock, canDeleteBlock } =
    useBlockActions();
  const [contextMenu, setContextMenu] = useState<{
    block: Block;
    x: number;
    y: number;
  } | null>(null);

  // If contextBlockId is provided, use that block as root, otherwise use the actual root
  const displayBlock = contextBlockId ? getBlock(contextBlockId) : getRootBlock();

  const handleContextMenu = (block: Block, event: React.MouseEvent) => {
    setContextMenu({
      block,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleRename = (block: Block) => {
    // In a real implementation, this would open a rename dialog
    const newName = prompt('Enter new name:', block.name);
    if (newName && newName.trim()) {
      renameBlock(block.id, newName.trim());
    }
  };

  const handleDuplicate = (block: Block) => {
    duplicateBlock(block.id);
  };

  const handleDelete = (block: Block) => {
    if (!canDeleteBlock(block.id)) {
      alert('Cannot delete root block');
      return;
    }

    if (confirm(`Are you sure you want to delete "${block.name}"?`)) {
      removeBlock(block.id);
    }
  };

  return (
    <aside className="block-explorer">
      <div className="block-explorer__header">
        <h2 className="block-explorer__title">Block Explorer</h2>
      </div>

      <nav className="block-explorer__content" role="navigation" aria-label="Block hierarchy">
        {displayBlock ? (
          <BlockTreeItem block={displayBlock} onContextMenu={handleContextMenu} />
        ) : (
          <div className="block-explorer__empty">
            <p>No blocks yet</p>
            <p className="block-explorer__empty-hint">Create a workflow to get started</p>
          </div>
        )}
      </nav>

      {contextMenu && (
        <BlockContextMenu
          block={contextMenu.block}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={handleCloseContextMenu}
          onRename={handleRename}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      )}
    </aside>
  );
}
