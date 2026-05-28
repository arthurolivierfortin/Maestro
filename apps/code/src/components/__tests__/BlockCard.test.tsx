import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockCard } from '../BlockCard';
import type { BlockDto } from '../../services/blockService';

const baseBlock: BlockDto = {
  id: 'b1',
  name: 'Git Commit Agent',
  blockType: 'agent',
  description: 'Commits code',
  isAtomic: false,
  tags: [],
};

describe('BlockCard', () => {
  it('renders block type as a themed badge', () => {
    const { container } = render(<BlockCard block={baseBlock} />);

    const badge = container.querySelector('.b');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('agent');
    expect(badge?.className).toContain('ac');
  });

  it('renders name and description', () => {
    render(<BlockCard block={baseBlock} />);

    expect(screen.getByText('Git Commit Agent')).toBeDefined();
    expect(screen.getByText('Commits code')).toBeDefined();
  });

  it('omits description when not provided', () => {
    render(<BlockCard block={{ ...baseBlock, description: '' }} />);

    expect(screen.getByText('Git Commit Agent')).toBeDefined();
    expect(screen.queryByText('Commits code')).toBeNull();
  });

  it('renders without onClick (no crash on click)', () => {
    render(<BlockCard block={baseBlock} />);
    fireEvent.click(screen.getByText('Git Commit Agent'));
    expect(screen.getByText('Git Commit Agent')).toBeDefined();
  });

  it('calls onClick with the block id when clicked', () => {
    const onClick = vi.fn();
    render(<BlockCard block={baseBlock} onClick={onClick} />);

    fireEvent.click(screen.getByText('Git Commit Agent'));
    expect(onClick).toHaveBeenCalledWith('b1');
  });
});
