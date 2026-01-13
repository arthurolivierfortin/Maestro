/**
 * BlockExplorer Component
 *
 * Main sidebar component showing block hierarchy.
 * Replaces the original Sidebar component.
 * Can be collapsed/expanded like the PropertiesPanel.
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useBlockActions } from '../../hooks';
import { useBlockStore } from '../../store/blockStore';
import { BlockTreeItem } from './BlockTreeItem';
import { BlockContextMenu } from './BlockContextMenu';
import type { Block } from '../../types/block.types';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import './BlockExplorer.scss';

interface BlockExplorerProps {
  contextBlockId?: string | null;
  panelRef?: React.RefObject<ImperativePanelHandle>;
}

export function BlockExplorer({ contextBlockId, panelRef }: BlockExplorerProps = {}) {
  const { getRootBlock, getBlock, removeBlock, duplicateBlock, renameBlock, canDeleteBlock } =
    useBlockActions();
  // Subscribe to block store changes to trigger re-render when blocks change
  useBlockStore((state) => state.blocks);
  const [contextMenu, setContextMenu] = useState<{
    block: Block;
    x: number;
    y: number;
  } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Sync isCollapsed with panel collapse state
  useEffect(() => {
    if (!panelRef) return;

    const handlePanelCollapse = () => {
      const panel = panelRef.current;
      if (panel) {
        const collapsed = panel.isCollapsed();
        setIsCollapsed(collapsed);
      }
    };

    // Check initial state and set up listener
    handlePanelCollapse();
    const interval = setInterval(handlePanelCollapse, 100);

    return () => clearInterval(interval);
  }, [panelRef]);

  const handleToggle = useCallback(() => {
    if (!panelRef?.current) return;

    const panel = panelRef.current;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [panelRef]);

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
    if (newName?.trim()) {
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
    <aside className="block-explorer" data-state={isCollapsed ? 'collapsed' : 'expanded'}>
      <div className="block-explorer__header">
        <button
          className="block-explorer__toggle-btn"
          onClick={handleToggle}
          aria-label={isCollapsed ? 'Expand block explorer' : 'Collapse block explorer'}
          aria-expanded={!isCollapsed}
        >
          <ChevronLeft size={16} />
        </button>
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
