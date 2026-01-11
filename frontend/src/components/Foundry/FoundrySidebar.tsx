/**
 * Foundry Sidebar Component
 *
 * Category filters for block types in the Foundry page.
 */

import { Package } from 'lucide-react';
import { Button } from '../common';
import { BlockIcon } from '../icons';
import type { BlockType } from '../../types/block.types';
import './FoundrySidebar.scss';

interface FoundrySidebarProps {
  selectedCategory: BlockType | 'all';
  onCategorySelect: (category: BlockType | 'all') => void;
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
  { id: 'agent', label: 'Agents' },
  { id: 'task', label: 'Tasks' },
  { id: 'tool', label: 'Tools' },
  { id: 'prompt', label: 'Prompts' },
  { id: 'instruction', label: 'Instructions' },
  { id: 'trigger', label: 'Triggers' },
  { id: 'workflow', label: 'Workflows' },
  { id: 'validator', label: 'Validators' },
  { id: 'decision', label: 'Decisions' },
];

export function FoundrySidebar({
  selectedCategory,
  onCategorySelect,
  onCreateBlock,
}: FoundrySidebarProps) {
  return (
    <aside className="foundry-sidebar">
      <div className="foundry-sidebar__header">
        <h2 className="foundry-sidebar__title">Categories</h2>
      </div>

      <nav className="foundry-sidebar__categories" role="navigation" aria-label="Block categories">
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
