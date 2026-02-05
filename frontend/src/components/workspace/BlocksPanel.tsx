/**
 * Blocks Panel Component
 *
 * Displays all blocks in a workspace using the exact same layout as FoundryPage.
 * Uses FoundrySidebar for category filtering and FoundrySearchBar for search.
 * The only difference is that blocks are filtered by workspace.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useBlockStore } from '../../store';
import { FoundrySidebar } from '../Foundry/FoundrySidebar';
import { FoundrySearchBar } from '../Foundry/FoundrySearchBar';
import { BlockGrid } from '../Foundry/BlockGrid';
import { CreateBlockWizard } from '../Foundry/CreateBlockWizard';
import { useFavorites } from '../../hooks/useFavorites';
import type { Block, BlockType } from '../../types/block.types';
import './BlocksPanel.scss';

interface BlocksPanelProps {
  workspaceId: string;
  blocks?: Block[]; // Optional: blocks can be passed directly or loaded from store
}

export const BlocksPanel: React.FC<BlocksPanelProps> = ({ workspaceId: _workspaceId, blocks: propBlocks }) => {
  // State for filters
  const [selectedCategory, setSelectedCategory] = useState<BlockType | 'all' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Get blocks from store if not provided via props
  const getAllBlocks = useBlockStore((s) => s.getAllBlocks);
  const { getFavorites } = useFavorites();

  // Use prop blocks if provided, otherwise get from store
  const allBlocks = useMemo(() => {
    return propBlocks ?? getAllBlocks();
  }, [propBlocks, getAllBlocks]);

  // Filter blocks based on current criteria
  const filteredBlocks = useMemo(() => {
    let blocks = allBlocks;

    // Filter by favorites
    if (selectedCategory === 'favorites') {
      const favoriteBlocks = getFavorites();
      // Only show favorites that are in the workspace
      const workspaceBlockIds = new Set(allBlocks.map(b => b.id));
      blocks = favoriteBlocks.filter(b => workspaceBlockIds.has(b.id));
    }
    // Filter by category (block type)
    else if (selectedCategory !== 'all') {
      blocks = blocks.filter((b) => b.blockType === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      blocks = blocks.filter((block) => {
        const matchesName = block.name.toLowerCase().includes(query);
        const matchesTags = block.metadata?.tags?.some(
          (tag) => tag.toLowerCase().includes(query)
        );
        const matchesDescription = block.metadata?.description?.toLowerCase().includes(query);
        return matchesName || matchesTags || matchesDescription;
      });
    }

    // Filter by capability
    if (selectedCapability) {
      blocks = blocks.filter((block) =>
        block.capabilities?.includes(selectedCapability)
      );
    }

    return blocks;
  }, [allBlocks, selectedCategory, searchQuery, selectedCapability, getFavorites]);

  // Handlers
  const handleCategorySelect = useCallback((category: BlockType | 'all' | 'favorites') => {
    setSelectedCategory(category);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleCapabilityChange = useCallback((capability: string | null) => {
    setSelectedCapability(capability);
  }, []);

  const handleCreateBlock = useCallback(() => {
    setIsWizardOpen(true);
  }, []);

  const handleWizardClose = useCallback(() => {
    setIsWizardOpen(false);
  }, []);

  return (
    <div className="blocks-panel">
      <div className="blocks-panel__layout">
        {/* Sidebar - Same as FoundryPage */}
        <FoundrySidebar
          selectedCategory={selectedCategory}
          onCategorySelect={handleCategorySelect}
          onCreateBlock={handleCreateBlock}
        />

        {/* Main Content */}
        <div className="blocks-panel__main">
          {/* Search Bar - Same as FoundryPage */}
          <FoundrySearchBar
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            selectedCapability={selectedCapability}
            onCapabilityChange={handleCapabilityChange}
          />

          {/* Results count */}
          <div className="blocks-panel__results-info">
            <span className="blocks-panel__results-count">
              {filteredBlocks.length} block{filteredBlocks.length !== 1 ? 's' : ''}
              {selectedCategory !== 'all' && ` in ${selectedCategory}`}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
          </div>

          {/* Block Grid - Same component as FoundryPage */}
          <BlockGrid blocks={filteredBlocks} />
        </div>
      </div>

      {/* Create Block Wizard */}
      {isWizardOpen && (
        <CreateBlockWizard
          isOpen={isWizardOpen}
          onClose={handleWizardClose}
        />
      )}
    </div>
  );
};

export default BlocksPanel;
