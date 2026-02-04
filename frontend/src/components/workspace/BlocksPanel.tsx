/**
 * Blocks Panel Component
 *
 * Displays all blocks in a workspace using the shared BlockGrid component.
 * Reuses Foundry components for consistent styling.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { blockService } from '../../services/blockService';
import { BlockGrid } from '../Foundry/BlockGrid';
import { Button } from '../common/Button';
import { BlockIcon } from '../icons';
import type { Block, BlockType } from '../../types/block.types';
import './BlocksPanel.scss';

interface BlocksPanelProps {
  workspaceId: string;
}

type FilterType = 'all' | BlockType;

const FILTER_OPTIONS: { id: FilterType; label: string; type?: BlockType }[] = [
  { id: 'all', label: 'All' },
  { id: 'tool', label: 'Tools', type: 'tool' },
  { id: 'agent', label: 'Agents', type: 'agent' },
  { id: 'workflow', label: 'Workflows', type: 'workflow' },
  { id: 'prompt', label: 'Prompts', type: 'prompt' },
  { id: 'inference', label: 'Inference', type: 'inference' },
];

export const BlocksPanel: React.FC<BlocksPanelProps> = ({ workspaceId }) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load blocks
  useEffect(() => {
    const loadBlocks = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const allBlocks = await blockService.getAll();
        setBlocks(allBlocks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load blocks');
      } finally {
        setIsLoading(false);
      }
    };

    loadBlocks();
  }, [workspaceId]);

  // Filter and search blocks
  const filteredBlocks = useMemo(() => {
    return blocks.filter(block => {
      // Type filter
      if (filter !== 'all' && block.blockType !== filter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = block.name.toLowerCase().includes(query);
        const matchesDescription = block.metadata?.description?.toLowerCase().includes(query);
        const matchesTags = block.metadata?.tags?.some(tag =>
          tag.toLowerCase().includes(query)
        );
        return matchesName || matchesDescription || matchesTags;
      }

      return true;
    });
  }, [blocks, filter, searchQuery]);

  // Group blocks by type for summary
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

  if (isLoading) {
    return (
      <div className="blocks-panel">
        <h2 className="blocks-panel__title">Blocks</h2>
        <div className="blocks-panel__loading">
          <span className="blocks-panel__spinner" />
          Loading blocks...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="blocks-panel">
        <h2 className="blocks-panel__title">Blocks</h2>
        <div className="blocks-panel__error">
          <X size={24} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="blocks-panel">
      {/* Header */}
      <div className="blocks-panel__header">
        <h2 className="blocks-panel__title">Blocks ({blocks.length})</h2>
      </div>

      {/* Summary - using Lucide BlockIcons */}
      <div className="blocks-panel__summary">
        {Object.entries(blocksByType).map(([type, typeBlocks]) => (
          <button
            key={type}
            className={`blocks-panel__summary-item ${filter === type ? 'blocks-panel__summary-item--active' : ''}`}
            onClick={() => setFilter(filter === type ? 'all' : type as FilterType)}
          >
            <BlockIcon type={type as BlockType} size={16} />
            <span className="blocks-panel__summary-label">{type}</span>
            <span className="blocks-panel__summary-count">{typeBlocks.length}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="blocks-panel__toolbar">
        <div className="blocks-panel__filters">
          {FILTER_OPTIONS.map(option => (
            <Button
              key={option.id}
              variant={filter === option.id ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(option.id)}
            >
              {option.type && <BlockIcon type={option.type} size={14} />}
              {option.label}
            </Button>
          ))}
        </div>
        <div className="blocks-panel__search">
          <Search size={16} className="blocks-panel__search-icon" />
          <input
            type="text"
            placeholder="Search blocks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="blocks-panel__search-input"
          />
          {searchQuery && (
            <button
              className="blocks-panel__search-clear"
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Block Grid - Reusing Foundry component */}
      <div className="blocks-panel__content">
        <BlockGrid blocks={filteredBlocks} />
      </div>
    </div>
  );
};

export default BlocksPanel;
