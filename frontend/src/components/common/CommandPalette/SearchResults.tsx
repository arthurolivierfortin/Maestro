/**
 * Search Results Component
 *
 * Displays search results with keyboard navigation.
 */

import React from 'react';
import { Play, GitBranch, Cpu } from 'lucide-react';
import { BlockIcon } from '../../icons/BlockIcons';
import type { Block } from '../../../types/block.types';
import type { Model } from '../../../types/model.types';

export interface SearchResult {
  id: string;
  name: string;
  type: 'block' | 'workflow' | 'model' | 'action';
  data: Block | Model | any;
  description?: string;
}

interface SearchResultsProps {
  results: SearchResult[];
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
  onHover: (index: number) => void;
}

/**
 * Search results list
 */
export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  selectedIndex,
  onSelect,
  onHover,
}) => {
  if (results.length === 0) {
    return (
      <div className="search-results-empty">
        <p>No results found</p>
      </div>
    );
  }

  return (
    <div className="search-results">
      {results.map((result, index) => (
        <div
          key={result.id}
          className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(result)}
          onMouseEnter={() => onHover(index)}
        >
          <div className="result-icon">
            {result.type === 'block' && (
              <BlockIcon type={(result.data as Block).blockType} size={20} />
            )}
            {result.type === 'action' && <Play size={18} />}
            {result.type === 'workflow' && <GitBranch size={18} />}
            {result.type === 'model' && <Cpu size={18} />}
          </div>
          <div className="result-content">
            <div className="result-name">{result.name}</div>
            {result.description && <div className="result-description">{result.description}</div>}
          </div>
          <div className="result-type">{result.type}</div>
        </div>
      ))}
    </div>
  );
};
