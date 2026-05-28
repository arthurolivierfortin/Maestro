import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CostCard } from '../CostCard';

describe('CostCard', () => {
  it('renders label and value', () => {
    render(<CostCard label="Today" value="$1.50" />);

    expect(screen.getByText('Today')).toBeDefined();
    expect(screen.getByText('$1.50')).toBeDefined();
  });

  it('renders subLabel when provided', () => {
    render(<CostCard label="Today" value="$1.50" subLabel="5 requests" />);

    expect(screen.getByText('5 requests')).toBeDefined();
  });

  it('does not render subLabel when not provided', () => {
    render(<CostCard label="Today" value="$0.00" />);

    expect(screen.queryByText('requests')).toBeNull();
  });
});
