/**
 * Foundry Page
 *
 * Unified interface for creating, managing, and discovering all block types.
 * Phase 4f.2 - Foundry Page Foundation
 */

import { useState, useMemo } from 'react';
import { BlockGrid } from '../components/Foundry/BlockGrid';
import { FoundrySidebar } from '../components/Foundry/FoundrySidebar';
import { FoundrySearchBar } from '../components/Foundry/FoundrySearchBar';
import { useBlockStore } from '../store/blockStore';
import type { BlockType } from '../types/block.types';
import './FoundryPage.scss';

export type BlockCategory = 'all' | BlockType;

export function FoundryPage() {
  const [selectedCategory, setSelectedCategory] = useState<BlockCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<BlockType[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);

  const { getAllBlocks, searchBlocks } = useBlockStore();

  // Filter blocks based on sidebar selection, search, and filters
  const filteredBlocks = useMemo(() => {
    let blocks = getAllBlocks();

    // Filter by category (sidebar)
    if (selectedCategory !== 'all') {
      blocks = blocks.filter((block) => block.blockType === selectedCategory);
    }

    // Filter by type (dropdown)
    if (selectedTypes.length > 0) {
      blocks = blocks.filter((block) => selectedTypes.includes(block.blockType));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const searchResults = searchBlocks(searchQuery);
      const searchIds = new Set(searchResults.map((b) => b.id));
      blocks = blocks.filter((block) => searchIds.has(block.id));
    }

    // Filter by capabilities
    if (selectedCapabilities.length > 0) {
      blocks = blocks.filter((block) => {
        return selectedCapabilities.some((cap) => {
          // Check tags
          if (block.metadata.tags?.includes(cap)) return true;

          // Check type-specific capabilities
          if (block.config.type === 'agent') {
            const agentConfig = block.config as any;
            return agentConfig.agentType?.toLowerCase().includes(cap.toLowerCase());
          }
          if (block.config.type === 'tool') {
            const toolConfig = block.config as any;
            return toolConfig.toolType?.toLowerCase().includes(cap.toLowerCase());
          }
          return false;
        });
      });
    }

    return blocks;
  }, [
    selectedCategory,
    searchQuery,
    selectedTypes,
    selectedCapabilities,
    getAllBlocks,
    searchBlocks,
  ]);

  return (
    <div className="foundry-page">
      <div className="foundry-header">
        <h1>Foundry</h1>
        <p>Create, manage, and discover all block types</p>
      </div>

      <div className="foundry-layout">
        <FoundrySidebar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />

        <div className="foundry-content">
          <FoundrySearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedTypes={selectedTypes}
            onTypesChange={setSelectedTypes}
            selectedCapabilities={selectedCapabilities}
            onCapabilitiesChange={setSelectedCapabilities}
          />

          <BlockGrid blocks={filteredBlocks} />
        </div>
      </div>
    </div>
  );
}

export default FoundryPage;
