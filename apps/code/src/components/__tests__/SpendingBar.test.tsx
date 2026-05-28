import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpendingBar } from '../SpendingBar';

describe('SpendingBar', () => {
  it('renders label and current/max values', () => {
    render(<SpendingBar label="Daily" current={3.5} max={5.0} />);

    expect(screen.getByText('Daily')).toBeDefined();
    expect(screen.getByText('$3.50 / $5.00')).toBeDefined();
  });

  it('shows percentage', () => {
    render(<SpendingBar label="Daily" current={3.5} max={5.0} />);

    expect(screen.getByText('70%')).toBeDefined();
  });

  it('renders enforcement badge when provided', () => {
    render(<SpendingBar label="Daily" current={1.0} max={5.0} enforcement="warn" />);

    expect(screen.getByText('warn')).toBeDefined();
  });

  it('shows "No limit" when max is 0', () => {
    render(<SpendingBar label="Session" current={0} max={0} />);

    expect(screen.getByText('No limit')).toBeDefined();
  });

  it('clamps percentage at 100% when current exceeds max', () => {
    render(<SpendingBar label="Daily" current={7.0} max={5.0} />);

    expect(screen.getByText('100%')).toBeDefined();
  });

  it('renders an ASCII bar with full (█) and empty (░) segments', () => {
    const { container } = render(<SpendingBar label="Daily" current={2.5} max={5.0} />);

    const bar = container.querySelector('.bar-ascii');
    expect(bar).not.toBeNull();
    expect(bar?.textContent).toContain('█');
    expect(bar?.textContent).toContain('░');
  });
});
