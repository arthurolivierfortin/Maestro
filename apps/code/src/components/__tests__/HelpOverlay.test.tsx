import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpOverlay } from '../HelpOverlay';

describe('HelpOverlay', () => {
  it('renders shortcuts section', () => {
    render(<HelpOverlay onClose={vi.fn()} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeDefined();
  });

  it('renders navigation shortcuts', () => {
    render(<HelpOverlay onClose={vi.fn()} />);
    expect(screen.getByText('Navigate pages')).toBeDefined();
    expect(screen.getByText('Toggle help')).toBeDefined();
  });

  it('renders slash commands section', () => {
    render(<HelpOverlay onClose={vi.fn()} />);
    expect(screen.getByText('Slash Commands')).toBeDefined();
    expect(screen.getByText('/help')).toBeDefined();
    expect(screen.getByText('/clear')).toBeDefined();
    expect(screen.getByText('/quit')).toBeDefined();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<HelpOverlay onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<HelpOverlay onClose={onClose} />);
    fireEvent.click(screen.getByTestId('help-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close when content area is clicked', () => {
    const onClose = vi.fn();
    render(<HelpOverlay onClose={onClose} />);
    fireEvent.click(screen.getByTestId('help-content'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
