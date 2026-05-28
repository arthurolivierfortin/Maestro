import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockDetail } from '../BlockDetail';
import type { BlockDto } from '../../services/blockService';

const block: BlockDto = {
  id: 'json-validator',
  name: 'JSON Validator',
  blockType: 'tool',
  description: 'Validates JSON',
  isAtomic: true,
  tags: ['json', 'validation'],
  designation: 'tool',
  category: 'code',
};

describe('BlockDetail', () => {
  it('renders the metadata header always', () => {
    render(<BlockDetail block={block} configContent={null} promptContent={null} onClose={vi.fn()} />);

    expect(screen.getByText('json-validator')).toBeDefined();
    expect(screen.getByText('JSON Validator')).toBeDefined();
    // type badge
    const { container } = render(<BlockDetail block={block} configContent={null} promptContent={null} onClose={vi.fn()} />);
    expect(container.querySelector('.b')?.textContent).toBe('tool');
  });

  it('hides content sections when content is absent', () => {
    render(<BlockDetail block={block} configContent={null} promptContent={null} onClose={vi.fn()} />);

    expect(screen.queryByText('block.json')).toBeNull();
    expect(screen.queryByText('system-prompt.md')).toBeNull();
  });

  it('shows the block.json section only when configContent is present', () => {
    render(
      <BlockDetail block={block} configContent={'{"id":"json-validator"}'} promptContent={null} onClose={vi.fn()} />
    );

    expect(screen.getByText('block.json')).toBeDefined();
    expect(screen.queryByText('system-prompt.md')).toBeNull();
  });

  it('shows the system-prompt section only when promptContent is present', () => {
    render(
      <BlockDetail block={block} configContent={null} promptContent={'# You are a validator'} onClose={vi.fn()} />
    );

    expect(screen.getByText('system-prompt.md')).toBeDefined();
    expect(screen.getByText('# You are a validator')).toBeDefined();
    expect(screen.queryByText('block.json')).toBeNull();
  });

  it('pretty-prints valid JSON and falls back to raw text on parse failure', () => {
    render(
      <BlockDetail block={block} configContent={'{"id":"x","n":1}'} promptContent={null} onClose={vi.fn()} />
    );
    // pretty-printed JSON contains a newline + indentation around the key
    expect(screen.getByText(/"id": "x"/)).toBeDefined();

    render(
      <BlockDetail block={block} configContent={'not json'} promptContent={null} onClose={vi.fn()} />
    );
    expect(screen.getByText('not json')).toBeDefined();
  });

  it('calls onClose when Close is clicked', () => {
    const onClose = vi.fn();
    render(<BlockDetail block={block} configContent={null} promptContent={null} onClose={onClose} />);

    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
