/**
 * Foundry Search Bar
 *
 * Search and filter controls for the Foundry page.
 * Phase 4f.2 - Foundry Page Foundation
 */

import { useRef } from 'react';
import type { BlockType } from '../../types/block.types';
import './FoundrySearchBar.scss';

interface FoundrySearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTypes: BlockType[];
  onTypesChange: (types: BlockType[]) => void;
  selectedCapabilities: string[];
  onCapabilitiesChange: (capabilities: string[]) => void;
}

const BLOCK_TYPES: BlockType[] = [
  'workflow',
  'agent',
  'task',
  'tool',
  'prompt',
  'instruction',
  'decision',
  'validator',
  'trigger',
];

const CAPABILITIES = [
  'code-generation',
  'file-ops',
  'git-ops',
  'planning',
  'testing',
  'reviewing',
  'debugging',
];

export function FoundrySearchBar({
  searchQuery,
  onSearchChange,
  selectedTypes,
  onTypesChange,
  selectedCapabilities,
  onCapabilitiesChange,
}: FoundrySearchBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleTypeToggle = (type: BlockType) => {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter((t) => t !== type));
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  };

  const handleCapabilityToggle = (capability: string) => {
    if (selectedCapabilities.includes(capability)) {
      onCapabilitiesChange(selectedCapabilities.filter((c) => c !== capability));
    } else {
      onCapabilitiesChange([...selectedCapabilities, capability]);
    }
  };

  const clearFilters = () => {
    onSearchChange('');
    onTypesChange([]);
    onCapabilitiesChange([]);
  };

  const hasActiveFilters = searchQuery || selectedTypes.length > 0 || selectedCapabilities.length > 0;

  return (
    <div className="foundry-search-bar">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          ref={searchInputRef}
          type="text"
          className="search-input"
          placeholder="Search blocks by name, type, or tags..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search blocks"
        />
        {searchQuery && (
          <button
            className="clear-search-btn"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <div className="filter-controls">
        <div className="filter-group">
          <label className="filter-label">Type:</label>
          <div className="filter-pills">
            {BLOCK_TYPES.map((type) => (
              <button
                key={type}
                className={`filter-pill ${selectedTypes.includes(type) ? 'active' : ''}`}
                onClick={() => handleTypeToggle(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">Capability:</label>
          <div className="filter-pills">
            {CAPABILITIES.map((capability) => (
              <button
                key={capability}
                className={`filter-pill ${selectedCapabilities.includes(capability) ? 'active' : ''}`}
                onClick={() => handleCapabilityToggle(capability)}
              >
                {capability}
              </button>
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <button className="clear-filters-btn" onClick={clearFilters}>
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
