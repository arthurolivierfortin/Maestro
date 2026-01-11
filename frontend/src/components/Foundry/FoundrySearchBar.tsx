/**
 * Foundry Search Bar Component
 *
 * Search and filter controls for the Foundry page.
 */

import { Search } from 'lucide-react';
import './FoundrySearchBar.scss';

interface FoundrySearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCapability: string | null;
  onCapabilityChange: (capability: string | null) => void;
}

/**
 * Common capabilities for filtering
 */
const CAPABILITIES = [
  'code-generation',
  'file-ops',
  'git-ops',
  'testing',
  'debugging',
  'documentation',
  'validation',
  'api-calls',
];

export function FoundrySearchBar({
  searchQuery,
  onSearchChange,
  selectedCapability,
  onCapabilityChange,
}: FoundrySearchBarProps) {
  return (
    <div className="foundry-search-bar">
      {/* Search input */}
      <div className="foundry-search-bar__input-wrapper">
        <Search size={20} className="foundry-search-bar__search-icon" />
        <input
          type="text"
          className="foundry-search-bar__input"
          placeholder="Search blocks by name, tags, or description..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search blocks"
        />
        {searchQuery && (
          <button
            className="foundry-search-bar__clear"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Capability filter */}
      <div className="foundry-search-bar__filters">
        <label htmlFor="capability-filter" className="foundry-search-bar__filter-label">
          Capability:
        </label>
        <select
          id="capability-filter"
          className="foundry-search-bar__filter-select"
          value={selectedCapability || ''}
          onChange={(e) => onCapabilityChange(e.target.value || null)}
          aria-label="Filter by capability"
        >
          <option value="">All Capabilities</option>
          {CAPABILITIES.map((capability) => (
            <option key={capability} value={capability}>
              {capability.replace('-', ' ')}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
