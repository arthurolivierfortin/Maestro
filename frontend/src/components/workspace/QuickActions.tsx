/**
 * Quick Actions Component
 *
 * Displays entry points as action buttons for quick access.
 */

import React, { useState, useEffect } from 'react';
import { blockService } from '../../services/blockService';
import type { Block } from '../../types/block.types';
import { BlockExecuteModal } from './BlockExecuteModal';
import './QuickActions.scss';

interface EntryPoint {
  blockId: string;
  name: string;
  description?: string;
  icon?: string;
  type: 'main' | 'dashboard' | 'experiments' | 'settings' | 'custom';
}

interface QuickActionsProps {
  workspaceId: string;
  entryPoints?: EntryPoint[];
}

const ENTRY_POINT_ICONS: Record<string, string> = {
  main: '▶',
  dashboard: '📊',
  experiments: '🧪',
  settings: '⚙️',
  custom: '🔗',
};

export const QuickActions: React.FC<QuickActionsProps> = ({
  workspaceId,
  entryPoints: rawEntryPoints = [],
}) => {
  // Ensure entryPoints is always an array
  const entryPoints = Array.isArray(rawEntryPoints) ? rawEntryPoints : [];

  const [executeBlock, setExecuteBlock] = useState<Block | null>(null);
  const [blocks, setBlocks] = useState<Record<string, Block>>({});

  // Load blocks for entry points
  useEffect(() => {
    const loadBlocks = async () => {
      const blockMap: Record<string, Block> = {};
      for (const ep of entryPoints) {
        try {
          const block = await blockService.getById(ep.blockId);
          if (block) {
            blockMap[ep.blockId] = block;
          }
        } catch (err) {
          console.error(`Failed to load block ${ep.blockId}:`, err);
        }
      }
      setBlocks(blockMap);
    };

    if (entryPoints.length > 0) {
      loadBlocks();
    }
  }, [entryPoints]);

  const handleAction = async (entryPoint: EntryPoint) => {
    const block = blocks[entryPoint.blockId];
    if (block) {
      setExecuteBlock(block);
    }
  };

  if (entryPoints.length === 0) {
    return (
      <div className="quick-actions quick-actions--empty">
        <h3>Quick Actions</h3>
        <p className="quick-actions__empty-text">
          No entry points configured for this workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="quick-actions">
      <h3>Quick Actions</h3>
      <div className="quick-actions__buttons">
        {entryPoints.map((ep, index) => (
          <button
            key={ep.blockId || index}
            className={`quick-actions__button quick-actions__button--${ep.type}`}
            onClick={() => handleAction(ep)}
            title={ep.description}
          >
            <span className="quick-actions__icon">
              {ep.icon || ENTRY_POINT_ICONS[ep.type] || ENTRY_POINT_ICONS.custom}
            </span>
            <span className="quick-actions__label">{ep.name}</span>
            {ep.type === 'main' && (
              <span className="quick-actions__badge">Main</span>
            )}
          </button>
        ))}
      </div>

      {executeBlock && (
        <BlockExecuteModal
          block={executeBlock}
          workspaceId={workspaceId}
          onClose={() => setExecuteBlock(null)}
        />
      )}
    </div>
  );
};

export default QuickActions;
