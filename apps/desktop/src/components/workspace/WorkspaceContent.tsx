/**
 * Workspace Content Component
 *
 * Displays a summary of blocks in the workspace grouped by type.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { blockService } from '../../services/blockService';
import type { Block } from '../../types/block.types';
import './WorkspaceContent.scss';

interface WorkspaceContentProps {
  workspaceId: string;
  onViewAll?: () => void;
}

const BLOCK_TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  tool: { icon: '🔧', label: 'Tools' },
  agent: { icon: '🤖', label: 'Agents' },
  workflow: { icon: '🔄', label: 'Workflows' },
  prompt: { icon: '💬', label: 'Prompts' },
  inference: { icon: '🧠', label: 'Inference' },
  task: { icon: '📋', label: 'Tasks' },
  decision: { icon: '🔀', label: 'Decisions' },
  validator: { icon: '✅', label: 'Validators' },
  trigger: { icon: '⚡', label: 'Triggers' },
  script: { icon: '📜', label: 'Scripts' },
};

export const WorkspaceContent: React.FC<WorkspaceContentProps> = ({
  workspaceId,
  onViewAll,
}) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBlocks = async () => {
      setIsLoading(true);
      try {
        const allBlocks = await blockService.getAll();
        setBlocks(allBlocks);
      } catch (err) {
        console.error('Failed to load blocks:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadBlocks();
  }, [workspaceId]);

  const blocksByType = useMemo(() => {
    const grouped: Record<string, Block[]> = {};
    blocks.forEach(block => {
      if (!grouped[block.blockType]) {
        grouped[block.blockType] = [];
      }
      grouped[block.blockType].push(block);
    });
    return grouped;
  }, [blocks]);

  const sortedTypes = useMemo(() => {
    return Object.keys(blocksByType).sort((a, b) => {
      const priority = ['workflow', 'agent', 'tool', 'prompt', 'inference'];
      const aIndex = priority.indexOf(a);
      const bIndex = priority.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [blocksByType]);

  if (isLoading) {
    return (
      <div className="workspace-content workspace-content--loading">
        <h3>Workspace Content</h3>
        <div className="workspace-content__loading">Loading...</div>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="workspace-content workspace-content--empty">
        <h3>Workspace Content</h3>
        <p className="workspace-content__empty-text">
          No blocks in this workspace yet.
        </p>
      </div>
    );
  }

  return (
    <div className="workspace-content">
      <div className="workspace-content__header">
        <h3>Workspace Content</h3>
        <span className="workspace-content__total">
          {blocks.length} blocks
        </span>
      </div>

      <div className="workspace-content__tree">
        {sortedTypes.map(type => {
          const typeBlocks = blocksByType[type];
          const config = BLOCK_TYPE_CONFIG[type] || { icon: '📦', label: type };
          const displayBlocks = typeBlocks.slice(0, 4);
          const hasMore = typeBlocks.length > 4;

          return (
            <div key={type} className="workspace-content__group">
              <div className="workspace-content__group-header">
                <span className="workspace-content__group-icon">{config.icon}</span>
                <span className="workspace-content__group-label">{config.label}</span>
                <span className="workspace-content__group-count">({typeBlocks.length})</span>
              </div>
              <div className="workspace-content__group-items">
                {displayBlocks.map(block => (
                  <div key={block.id} className="workspace-content__item">
                    <span className="workspace-content__item-connector">├─</span>
                    <span className="workspace-content__item-name">{block.name}</span>
                  </div>
                ))}
                {hasMore && (
                  <div className="workspace-content__item workspace-content__item--more">
                    <span className="workspace-content__item-connector">└─</span>
                    <span className="workspace-content__item-more">
                      +{typeBlocks.length - 4} more
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {onViewAll && (
        <button className="workspace-content__view-all" onClick={onViewAll}>
          View All Blocks →
        </button>
      )}
    </div>
  );
};

export default WorkspaceContent;
