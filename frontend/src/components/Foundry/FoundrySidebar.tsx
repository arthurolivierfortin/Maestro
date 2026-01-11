/**
 * Foundry Sidebar Component
 *
 * Category filters for block types in the Foundry page.
 */

import { Button } from '../common';
import type { BlockType } from '../../types/block.types';
import './FoundrySidebar.scss';

interface FoundrySidebarProps {
  selectedCategory: BlockType | 'all';
  onCategorySelect: (category: BlockType | 'all') => void;
  onCreateBlock: () => void;
}

/**
 * Category definitions with icons and labels
 */
const CATEGORIES: Array<{
  id: BlockType | 'all';
  label: string;
  icon: string;
  types?: BlockType[];
}> = [
  { id: 'all', label: 'All Blocks', icon: '📦' },
  { id: 'agent', label: 'Agents', icon: '🤖' },
  { id: 'task', label: 'Tasks', icon: '📋' },
  { id: 'tool', label: 'Tools', icon: '🔧' },
  { id: 'prompt', label: 'Prompts', icon: '📝' },
  { id: 'instruction', label: 'Instructions', icon: '📄' },
  { id: 'trigger', label: 'Triggers', icon: '⚡' },
  { id: 'workflow', label: 'Workflows', icon: '🔀' },
  { id: 'validator', label: 'Validators', icon: '✅' },
  { id: 'decision', label: 'Decisions', icon: '❓' },
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
            <span className="foundry-sidebar__category-icon">{category.icon}</span>
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
