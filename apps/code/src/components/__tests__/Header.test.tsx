import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Header } from '../Header';

describe('Header term-title + tabs', () => {
  it('renders the brand and term-title', () => {
    const { container } = render(<Header currentPage="console" onNavigate={vi.fn()} />);
    expect(container.querySelector('.term-title')).not.toBeNull();
    expect(container.querySelector('.wm')).not.toBeNull();
  });

  it('renders a tabs row with a .n key number per tab', () => {
    const { container } = render(<Header currentPage="console" onNavigate={vi.fn()} />);
    expect(container.querySelector('.tabs')).not.toBeNull();
    expect(container.querySelectorAll('.tab').length).toBe(5);
    expect(container.querySelector('.tab .n')).not.toBeNull();
  });

  it('marks the active tab', () => {
    const { container } = render(<Header currentPage="spaces" onNavigate={vi.fn()} />);
    const active = container.querySelector('.tab.active');
    expect(active).not.toBeNull();
    expect(active?.textContent).toContain('Spaces');
  });

  it('calls onNavigate with the tab page id on click', () => {
    const onNavigate = vi.fn();
    const { container } = render(<Header currentPage="console" onNavigate={onNavigate} />);
    const tabs = container.querySelectorAll<HTMLElement>('.tab');
    tabs[1].click();
    expect(onNavigate).toHaveBeenCalledWith('spaces');
  });
});
