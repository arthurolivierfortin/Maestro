/**
 * Command Palette Component
 *
 * Global search palette with fuzzy search and keyboard navigation.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { SearchResults, type SearchResult } from './SearchResults';
import { getRecentItems, addRecentItem, clearRecentItems } from './recentItems';
import { useBlockStore } from '../../../store/blockStore';
import './CommandPalette.scss';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Command Palette
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const blocksMap = useBlockStore((state) => state.blocks);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search on query change
  useEffect(() => {
    if (!isOpen) return;

    if (query.trim() === '') {
      // Show recent items
      const recent = getRecentItems();
      const recentResults: SearchResult[] = recent.map((item) => {
        if (item.type === 'block') {
          const block = blocksMap.get(item.id);
          return {
            id: item.id,
            name: item.name,
            type: 'block',
            data: block,
            description: 'Recent',
          };
        }
        return {
          id: item.id,
          name: item.name,
          type: item.type,
          data: {},
          description: 'Recent',
        };
      });
      setResults(recentResults);
      return;
    }

    // Search blocks
    const searchTerm = query.toLowerCase();
    const blocks = Array.from(blocksMap.values());
    const blockResults: SearchResult[] = blocks
      .filter(
        (b) =>
          b.name.toLowerCase().includes(searchTerm) ||
          b.metadata.description?.toLowerCase().includes(searchTerm) ||
          b.metadata.tags?.some((tag) => tag.toLowerCase().includes(searchTerm))
      )
      .slice(0, 10)
      .map((block) => ({
        id: block.id,
        name: block.name,
        type: 'block' as const,
        data: block,
        description: block.metadata?.description,
      }));

    // Quick actions
    const actions: SearchResult[] = [];
    if ('new block'.includes(searchTerm)) {
      actions.push({
        id: 'action-new-block',
        name: 'Create new block',
        type: 'action',
        data: { action: 'new-block' },
      });
    }
    if ('new workflow'.includes(searchTerm)) {
      actions.push({
        id: 'action-new-workflow',
        name: 'Create new workflow',
        type: 'action',
        data: { action: 'new-workflow' },
      });
    }

    setResults([...actions, ...blockResults]);
    setSelectedIndex(0);
  }, [query, isOpen, blocksMap]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'block') {
      const block = result.data;
      addRecentItem({ id: block.id, name: block.name, type: 'block' });

      if (block.isAtomic) {
        navigate(`/foundry/${block.id}/edit`);
      } else {
        navigate(`/canvas/${block.id}`);
      }
    } else if (result.type === 'action') {
      if (result.data.action === 'new-block') {
        navigate('/foundry');
        // Trigger block creation wizard
      } else if (result.data.action === 'new-workflow') {
        navigate('/canvas');
      }
    }

    onClose();
    setQuery('');
  };

  const handleClearRecent = () => {
    clearRecentItems();
    setResults([]);
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-header">
          <Search size={20} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search blocks, workflows, models..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="palette-input"
          />
          <button className="close-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="palette-body">
          {query === '' && results.length > 0 && (
            <div className="recent-header">
              <span>Recent</span>
              <button className="clear-recent" onClick={handleClearRecent}>
                Clear
              </button>
            </div>
          )}

          <SearchResults
            results={results}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
            onHover={setSelectedIndex}
          />
        </div>

        <div className="palette-footer">
          <div className="keyboard-hints">
            <span>
              <kbd>↑↓</kbd> Navigate
            </span>
            <span>
              <kbd>↵</kbd> Select
            </span>
            <span>
              <kbd>Esc</kbd> Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
