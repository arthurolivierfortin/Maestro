/**
 * Foundry Page
 *
 * Unified interface for creating, managing, and discovering all block types.
 * Replaces separate pages for agents, tools, prompts, workflows, etc.
 */

import { useState, useMemo } from 'react';
import { useBlockStore } from '../store';
import type { BlockType } from '../types/block.types';
import { FoundrySidebar } from '../components/Foundry/FoundrySidebar';
import { FoundrySearchBar } from '../components/Foundry/FoundrySearchBar';
import { BlockGrid } from '../components/Foundry/BlockGrid';
import './FoundryPage.scss';

export function FoundryPage() {
  const [selectedCategory, setSelectedCategory] = useState<BlockType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);

  const { getAllBlocks, searchBlocks } = useBlockStore();

  /**
   * Filter blocks based on current criteria
   */
  const filteredBlocks = useMemo(() => {
    let blocks = getAllBlocks();

    // Filter by category (block type)
    if (selectedCategory !== 'all') {
      blocks = blocks.filter((block) => block.blockType === selectedCategory);
    }

    // Filter by capability
    if (selectedCapability) {
      blocks = blocks.filter(
        (block) => block.capabilities && block.capabilities.includes(selectedCapability)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const searchResults = searchBlocks(searchQuery);
      const searchIds = new Set(searchResults.map((b) => b.id));
      blocks = blocks.filter((block) => searchIds.has(block.id));
    }

    return blocks;
  }, [selectedCategory, selectedCapability, searchQuery, getAllBlocks, searchBlocks]);

  /**
   * Handle category selection from sidebar
   */
  const handleCategorySelect = (category: BlockType | 'all') => {
    setSelectedCategory(category);
  };

  /**
   * Handle search query change
   */
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  /**
   * Handle capability filter
   */
  const handleCapabilityFilter = (capability: string | null) => {
    setSelectedCapability(capability);
  };

  /**
   * Handle create new block
   */
  const handleCreateBlock = () => {
    // TODO: Open CreateBlockWizard modal (Phase 4f.4)
    console.log('Create new block');
  };

  return (
    <div className="foundry-page">
      <div className="foundry-page__header">
        <h1 className="foundry-page__title">Foundry</h1>
        <p className="foundry-page__subtitle">
          Discover and manage all reusable blocks: agents, tools, prompts, workflows, and more.
        </p>
      </div>

      <div className="foundry-page__layout">
        {/* Sidebar - Category filters */}
        <FoundrySidebar
          selectedCategory={selectedCategory}
          onCategorySelect={handleCategorySelect}
          onCreateBlock={handleCreateBlock}
        />

        {/* Main content area */}
        <div className="foundry-page__main">
          {/* Search bar with filters */}
          <FoundrySearchBar
            searchQuery={searchQuery}
            onSearchChange={handleSearch}
            selectedCapability={selectedCapability}
            onCapabilityChange={handleCapabilityFilter}
          />

          {/* Block grid */}
          <BlockGrid blocks={filteredBlocks} />
        </div>
      </div>
    </div>
  );
}

export default FoundryPage;
