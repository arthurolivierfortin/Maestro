/**
 * Foundry Sidebar
 *
 * Category filter sidebar for the Foundry page.
 * Phase 4f.2 - Foundry Page Foundation
 */

import { Button } from '../common';
import type { BlockCategory } from '../../pages/FoundryPage';
import './FoundrySidebar.scss';

interface CategoryItem {
  id: BlockCategory;
  label: string;
  icon: string;
  description?: string;
}

const CATEGORIES: CategoryItem[] = [
  { id: 'all', label: 'All Blocks', icon: '📦', description: 'View all blocks' },
  { id: 'agent', label: 'Agents', icon: '🤖', description: 'AI agents' },
  { id: 'task', label: 'Tasks', icon: '📋', description: 'Task definitions' },
  { id: 'tool', label: 'Tools', icon: '🔧', description: 'Executable tools' },
  { id: 'prompt', label: 'Prompts', icon: '📝', description: 'Prompt templates' },
  { id: 'instruction', label: 'Instructions', icon: '📄', description: 'Instruction files' },
  { id: 'trigger', label: 'Triggers', icon: '⚡', description: 'Workflow triggers' },
  { id: 'workflow', label: 'Workflows', icon: '🔀', description: 'Workflow definitions' },
  { id: 'validator', label: 'Validators', icon: '✅', description: 'Validation rules' },
  { id: 'decision', label: 'Decisions', icon: '❓', description: 'Decision nodes' },
];

interface FoundrySidebarProps {
  selectedCategory: BlockCategory;
  onCategoryChange: (category: BlockCategory) => void;
}

export function FoundrySidebar({ selectedCategory, onCategoryChange }: FoundrySidebarProps) {
  return (
    <aside className="foundry-sidebar">
      <div className="sidebar-header">
        <h2>Categories</h2>
      </div>

      <nav className="category-list">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            className={`category-item ${selectedCategory === category.id ? 'active' : ''}`}
            onClick={() => onCategoryChange(category.id)}
            title={category.description}
          >
            <span className="category-icon">{category.icon}</span>
            <span className="category-label">{category.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Button variant="primary" size="medium" fullWidth>
          <span className="button-icon">+</span>
          Create Block
        </Button>
      </div>
    </aside>
  );
}
