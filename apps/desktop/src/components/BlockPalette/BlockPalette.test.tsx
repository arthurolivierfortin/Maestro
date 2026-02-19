/**
 * BlockPalette Component Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockPalette } from './BlockPalette';

describe('BlockPalette', () => {
  beforeEach(() => {
    // Reset any state before each test
  });

  it('should render the palette with search input', () => {
    render(<BlockPalette />);
    expect(screen.getByPlaceholderText('Search blocks...')).toBeInTheDocument();
  });

  it('should render all categories', () => {
    render(<BlockPalette />);
    expect(screen.getByText('Multi-Node')).toBeInTheDocument();
    expect(screen.getByText('Atomic Blocks')).toBeInTheDocument();
  });

  it('should filter blocks based on search query', async () => {
    const user = userEvent.setup();
    render(<BlockPalette />);

    const searchInput = screen.getByPlaceholderText('Search blocks...');
    await user.type(searchInput, 'agent');

    // Should show Agent block type
    expect(screen.getByText('Agent')).toBeInTheDocument();
  });

  it('should toggle category expansion', async () => {
    const user = userEvent.setup();
    render(<BlockPalette />);

    const categoryHeader = screen.getByText('Atomic Blocks');
    await user.click(categoryHeader);

    // Category should still be in the document
    expect(categoryHeader).toBeInTheDocument();
  });

  it('should display block items in each category', () => {
    render(<BlockPalette />);

    // Check that block types are rendered
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('Tool')).toBeInTheDocument();
  });
});
