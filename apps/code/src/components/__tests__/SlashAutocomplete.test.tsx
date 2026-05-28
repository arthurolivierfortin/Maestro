import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlashAutocomplete } from '../SlashAutocomplete';

describe('SlashAutocomplete', () => {
  it('renders filtered commands matching input', () => {
    render(<SlashAutocomplete input="/cl" selectedIndex={0} />);
    expect(screen.getByText('/clear')).toBeDefined();
  });

  it('does not render commands that do not match', () => {
    render(<SlashAutocomplete input="/cl" selectedIndex={0} />);
    expect(screen.queryByText('/help')).toBeNull();
  });

  it('highlights the selected index with accent background', () => {
    render(<SlashAutocomplete input="/" selectedIndex={1} />);
    const items = screen.getAllByTestId('slash-item');
    expect(items.length).toBeGreaterThan(1);
    // Selected item has border color as background
    expect(items[1].style.backgroundColor).not.toBe('transparent');
    // Non-selected has transparent
    expect(items[0].style.backgroundColor).toBe('transparent');
  });

  it('renders nothing when no commands match', () => {
    const { container } = render(<SlashAutocomplete input="/xyz" selectedIndex={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows all commands for "/" input', () => {
    render(<SlashAutocomplete input="/" selectedIndex={0} />);
    expect(screen.getByText('/help')).toBeDefined();
    expect(screen.getByText('/clear')).toBeDefined();
    expect(screen.getByText('/quit')).toBeDefined();
    expect(screen.getByText('/new')).toBeDefined();
    expect(screen.getByText('/stop')).toBeDefined();
  });

  it('shows command descriptions', () => {
    render(<SlashAutocomplete input="/he" selectedIndex={0} />);
    expect(screen.getByText('Show shortcuts and commands')).toBeDefined();
  });
});
