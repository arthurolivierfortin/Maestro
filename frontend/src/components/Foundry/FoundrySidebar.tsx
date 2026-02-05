/**
 * Foundry Sidebar Component
 *
 * Category filters for block types in the Foundry page.
 */

import { Package, Star } from 'lucide-react';
import { Button } from '../common';
import { BlockIcon } from '../icons';
import type { BlockType } from '../../types/block.types';
import { useFavorites } from '../../hooks/useFavorites';
import './FoundrySidebar.scss';

interface FoundrySidebarProps {
  selectedCategory: BlockType | 'all' | 'favorites';
  onCategorySelect: (category: BlockType | 'all' | 'favorites') => void;
  onCreateBlock: () => void;
}

/**
 * Category definitions with labels
 */
const CATEGORIES: Array<{
  id: BlockType | 'all';
  label: string;
  types?: BlockType[];
}> = [
  { id: 'all', label: 'All Blocks' },
  { id: 'task', label: 'Tasks' },
  { id: 'command', label: 'Commands' },
  { id: 'prompt', label: 'Prompts' },
  { id: 'instruction', label: 'Instructions' },
  { id: 'trigger', label: 'Triggers' },
  { id: 'workflow', label: 'Workflows' },
  { id: 'validator', label: 'Validators' },
  { id: 'decision', label: 'Decisions' },
  { id: 'inference', label: 'Inference' },
  { id: 'script', label: 'Scripts' },
];

export function FoundrySidebar({
  selectedCategory,
  onCategorySelect,
  onCreateBlock,
}: FoundrySidebarProps) {
  const { favoriteCount } = useFavorites();

  return (
    <aside className="foundry-sidebar">
      <div className="foundry-sidebar__header">
        <h2 className="foundry-sidebar__title">Categories</h2>
      </div>

      <nav className="foundry-sidebar__categories" role="navigation" aria-label="Block categories">
        {/* Favorites section */}
        {favoriteCount > 0 && (
          <>
            <button
              className={`foundry-sidebar__category ${
                selectedCategory === 'favorites' ? 'foundry-sidebar__category--active' : ''
              }`}
              onClick={() => onCategorySelect('favorites')}
              aria-label="View favorites"
              aria-current={selectedCategory === 'favorites' ? 'true' : undefined}
            >
              <span className="foundry-sidebar__category-icon">
                <Star size={20} fill={selectedCategory === 'favorites' ? 'currentColor' : 'none'} />
              </span>
              <span className="foundry-sidebar__category-label">Favorites</span>
              <span className="foundry-sidebar__category-count">{favoriteCount}</span>
            </button>
            <div className="foundry-sidebar__divider" />
          </>
        )}

        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            className={`foundry-sidebar__category ${
              selectedCategory === category.id ? 'foundry-sidebar__category--active' : ''
            }`}
            onClick={() => onCategorySelect(category.id)}
            aria-label={`Filter by ${category.label}`}
            aria-current={selectedCategory === category.id ? 'true' : undefined}
          >
            <span className="foundry-sidebar__category-icon">
              {category.id === 'all' ? (
                <Package size={20} />
              ) : (
                <BlockIcon type={category.id as BlockType} size={20} />
              )}
            </span>
            <span className="foundry-sidebar__category-label">{category.label}</span>
          </button>
        ))}
      </nav>

      <div className="foundry-sidebar__actions">
        <Button onClick={onCreateBlock} variant="primary" fullWidth>
          + Create Block
        </Button>
      </div>
    </aside>
  );
}
