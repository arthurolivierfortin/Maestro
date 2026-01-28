/**
 * FoundrySidebar Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FoundrySidebar } from './FoundrySidebar';
import type { BlockType } from '../../types/block.types';

describe('FoundrySidebar', () => {
  const mockOnCategorySelect = vi.fn();
  const mockOnCreateBlock = vi.fn();

  const defaultProps = {
    selectedCategory: 'all' as const,
    onCategorySelect: mockOnCategorySelect,
    onCreateBlock: mockOnCreateBlock,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all category buttons', () => {
    render(<FoundrySidebar {...defaultProps} />);

    expect(screen.getByText('All Blocks')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Commands')).toBeInTheDocument();
    expect(screen.getByText('Prompts')).toBeInTheDocument();
    expect(screen.getByText('Instructions')).toBeInTheDocument();
    expect(screen.getByText('Triggers')).toBeInTheDocument();
    expect(screen.getByText('Workflows')).toBeInTheDocument();
    expect(screen.getByText('Validators')).toBeInTheDocument();
    expect(screen.getByText('Decisions')).toBeInTheDocument();
    expect(screen.getByText('Inference')).toBeInTheDocument();
    expect(screen.getByText('Scripts')).toBeInTheDocument();
  });

  it('should render Lucide icons instead of emoji', () => {
    const { container } = render(<FoundrySidebar {...defaultProps} />);

    // Check that SVG icons are rendered (Lucide icons are SVG)
    const svgIcons = container.querySelectorAll('.foundry-sidebar__category-icon svg');
    expect(svgIcons.length).toBeGreaterThan(0);

    // Check that no emoji are present (emoji would be text nodes)
    const categoryIcons = container.querySelectorAll('.foundry-sidebar__category-icon');
    categoryIcons.forEach((icon) => {
      // Icon should contain SVG, not just text
      const svg = icon.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  it('should mark selected category as active', () => {
    render(<FoundrySidebar {...defaultProps} selectedCategory="task" />);

    const taskButton = screen.getByRole('button', { name: /filter by tasks/i });
    expect(taskButton).toHaveClass('foundry-sidebar__category--active');
  });

  it('should call onCategorySelect when category is clicked', async () => {
    const user = userEvent.setup();
    render(<FoundrySidebar {...defaultProps} />);

    const taskButton = screen.getByRole('button', { name: /filter by tasks/i });
    await user.click(taskButton);

    expect(mockOnCategorySelect).toHaveBeenCalledWith('task');
  });

  it('should call onCreateBlock when create button is clicked', async () => {
    const user = userEvent.setup();
    render(<FoundrySidebar {...defaultProps} />);

    const createButton = screen.getByRole('button', { name: /\+ create block/i });
    await user.click(createButton);

    expect(mockOnCreateBlock).toHaveBeenCalled();
  });

  it('should have proper aria attributes for accessibility', () => {
    render(<FoundrySidebar {...defaultProps} selectedCategory="task" />);

    const nav = screen.getByRole('navigation', { name: /block categories/i });
    expect(nav).toBeInTheDocument();

    const taskButton = screen.getByRole('button', { name: /filter by tasks/i });
    expect(taskButton).toHaveAttribute('aria-current', 'true');
  });

  it('should render all block type categories', () => {
    render(<FoundrySidebar {...defaultProps} />);

    const blockTypes: Array<BlockType | 'all'> = [
      'all',
      'task',
      'command',
      'prompt',
      'instruction',
      'trigger',
      'workflow',
      'validator',
      'decision',
      'inference',
      'script',
    ];

    blockTypes.forEach((type) => {
      const button = screen.getByRole('button', { name: new RegExp(`filter by.*${type}`, 'i') });
      expect(button).toBeInTheDocument();
    });
  });
});
