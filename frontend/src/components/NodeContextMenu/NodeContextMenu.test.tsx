/**
 * NodeContextMenu Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeContextMenu } from '../NodeContextMenu';
import type { Block } from '../../types/block.types';

describe('NodeContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBlock: Block = {
    id: 'test-block',
    name: 'Test Block',
    blockType: 'command',
    isAtomic: true,
    config: {
      type: 'command',
      commandType: 'Bash',
    },
    inputs: [],
    outputs: [],
    position: { x: 0, y: 0 },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test',
      tags: [],
      status: 'active',
    },
  };

  const mockHandlers = {
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onDrillInto: vi.fn(),
    onClose: vi.fn(),
  };

  it('should render all menu items', () => {
    render(<NodeContextMenu block={mockBlock} {...mockHandlers} />);

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should call onEdit when Edit is clicked', () => {
    render(<NodeContextMenu block={mockBlock} {...mockHandlers} />);

    fireEvent.click(screen.getByText('Edit'));

    expect(mockHandlers.onEdit).toHaveBeenCalledTimes(1);
    expect(mockHandlers.onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onDuplicate when Duplicate is clicked', () => {
    render(<NodeContextMenu block={mockBlock} {...mockHandlers} />);

    fireEvent.click(screen.getByText('Duplicate'));

    expect(mockHandlers.onDuplicate).toHaveBeenCalledTimes(1);
    expect(mockHandlers.onClose).toHaveBeenCalledTimes(1);
  });

  it('should show Drill Into for composite blocks', () => {
    const compositeBlock: Block = {
      ...mockBlock,
      isAtomic: false,
      children: [mockBlock],
    };

    render(<NodeContextMenu block={compositeBlock} {...mockHandlers} />);

    expect(screen.getByText('Drill Into')).toBeInTheDocument();
  });

  it('should not show Drill Into for atomic blocks', () => {
    render(<NodeContextMenu block={mockBlock} {...mockHandlers} />);

    expect(screen.queryByText('Drill Into')).not.toBeInTheDocument();
  });

  it('should show keyboard shortcuts', () => {
    render(<NodeContextMenu block={mockBlock} {...mockHandlers} />);

    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+D')).toBeInTheDocument();
    expect(screen.getByText('Del')).toBeInTheDocument();
  });
});
