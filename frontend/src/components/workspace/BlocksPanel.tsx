/**
 * Blocks Panel Component
 *
 * Displays all blocks in a workspace with filtering, searching,
 * and action capabilities (run, edit, view, delete).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { blockService } from '../../services/blockService';
import type { Block } from '../../types/block.types';
import { BlockExecuteModal } from './BlockExecuteModal';
import './BlocksPanel.scss';

interface BlocksPanelProps {
  workspaceId: string;
}

type FilterType = 'all' | 'tool' | 'agent' | 'workflow' | 'prompt' | 'inference';

const BLOCK_TYPE_ICONS: Record<string, string> = {
  tool: '🔧',
  agent: '🤖',
  workflow: '🔄',
  prompt: '💬',
  inference: '🧠',
  task: '📋',
  decision: '🔀',
  validator: '✅',
  trigger: '⚡',
  script: '📜',
  default: '📦',
};

const FILTER_OPTIONS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tool', label: 'Tools' },
  { id: 'agent', label: 'Agents' },
  { id: 'workflow', label: 'Workflows' },
  { id: 'prompt', label: 'Prompts' },
  { id: 'inference', label: 'Inference' },
];

export const BlocksPanel: React.FC<BlocksPanelProps> = ({ workspaceId }) => {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [executeBlock, setExecuteBlock] = useState<Block | null>(null);

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

  const handleRun = useCallback((block: Block) => {
    setExecuteBlock(block);
  }, []);

  const handleView = useCallback((block: Block) => {
    navigate(`/blocks/${block.id}`);
  }, [navigate]);

  const handleEdit = useCallback((block: Block) => {
    navigate(`/blocks/${block.id}/edit`);
  }, [navigate]);

  const handleDelete = useCallback(async (block: Block) => {
    if (!confirm(`Are you sure you want to delete "${block.name}"?`)) {
      return;
    }

    try {
      await blockService.delete(block.id);
      setBlocks(prev => prev.filter(b => b.id !== block.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete block');
    }
  }, []);

  const getBlockIcon = (type: string): string => {
    return BLOCK_TYPE_ICONS[type] || BLOCK_TYPE_ICONS.default;
  };

  if (isLoading) {
    return (
      <div className="blocks-panel">
        <h2>Blocks</h2>
        <div className="blocks-panel__loading">
          <span className="blocks-panel__spinner"></span>
          Loading blocks...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="blocks-panel">
        <h2>Blocks</h2>
        <div className="blocks-panel__error">
          <span className="blocks-panel__error-icon">❌</span>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="blocks-panel">
      {/* Header */}
      <div className="blocks-panel__header">
        <h2>Blocks ({blocks.length})</h2>
      </div>

      {/* Summary */}
      <div className="blocks-panel__summary">
        {Object.entries(blocksByType).map(([type, typeBlocks]) => (
          <button
            key={type}
            className={`blocks-panel__summary-item ${filter === type ? 'active' : ''}`}
            onClick={() => setFilter(filter === type ? 'all' : type as FilterType)}
          >
            <span className="blocks-panel__summary-icon">{getBlockIcon(type)}</span>
            <span className="blocks-panel__summary-label">{type}</span>
            <span className="blocks-panel__summary-count">{typeBlocks.length}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="blocks-panel__toolbar">
        <div className="blocks-panel__filters">
          {FILTER_OPTIONS.map(option => (
            <button
              key={option.id}
              className={`blocks-panel__filter ${filter === option.id ? 'active' : ''}`}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="blocks-panel__search">
          <input
            type="text"
            placeholder="Search blocks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="blocks-panel__search-clear"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Block List */}
      <div className="blocks-panel__list">
        {filteredBlocks.length === 0 ? (
          <div className="blocks-panel__empty">
            {searchQuery || filter !== 'all' ? (
              <p>No blocks match your filters.</p>
            ) : (
              <>
                <div className="blocks-panel__empty-icon">📦</div>
                <p>No blocks in this workspace yet.</p>
              </>
            )}
          </div>
        ) : (
          filteredBlocks.map(block => (
            <div key={block.id} className="block-card">
              <div className="block-card__header">
                <span className="block-card__icon">{getBlockIcon(block.blockType)}</span>
                <div className="block-card__title-group">
                  <h3 className="block-card__name">{block.name}</h3>
                  <span className="block-card__type">{block.blockType}</span>
                </div>
              </div>

              {block.metadata?.description && (
                <p className="block-card__description">
                  {block.metadata.description}
                </p>
              )}

              {block.metadata?.tags && block.metadata.tags.length > 0 && (
                <div className="block-card__tags">
                  {block.metadata.tags.slice(0, 5).map(tag => (
                    <span key={tag} className="block-card__tag">{tag}</span>
                  ))}
                  {block.metadata.tags.length > 5 && (
                    <span className="block-card__tag block-card__tag--more">
                      +{block.metadata.tags.length - 5}
                    </span>
                  )}
                </div>
              )}

              {block.capabilities && block.capabilities.length > 0 && (
                <div className="block-card__capabilities">
                  {block.capabilities.slice(0, 3).map(cap => (
                    <span key={cap} className="block-card__capability">{cap}</span>
                  ))}
                  {block.capabilities.length > 3 && (
                    <span className="block-card__capability block-card__capability--more">
                      +{block.capabilities.length - 3}
                    </span>
                  )}
                </div>
              )}

              <div className="block-card__actions">
                <button
                  className="block-card__action block-card__action--run"
                  onClick={() => handleRun(block)}
                  title="Run block"
                >
                  ▶ Run
                </button>
                <button
                  className="block-card__action"
                  onClick={() => handleView(block)}
                  title="View details"
                >
                  📋 View
                </button>
                <button
                  className="block-card__action"
                  onClick={() => handleEdit(block)}
                  title="Edit block"
                >
                  ✏️ Edit
                </button>
                <button
                  className="block-card__action block-card__action--delete"
                  onClick={() => handleDelete(block)}
                  title="Delete block"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Execute Modal */}
      {executeBlock && (
        <BlockExecuteModal
          block={executeBlock}
          workspaceId={workspaceId}
          onClose={() => setExecuteBlock(null)}
          onExecuted={(result) => {
            console.log('Block executed:', result);
          }}
        />
      )}
    </div>
  );
};

export default BlocksPanel;
