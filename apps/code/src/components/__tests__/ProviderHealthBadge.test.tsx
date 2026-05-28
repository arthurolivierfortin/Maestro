import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProviderHealthBadge } from '../ProviderHealthBadge';

describe('ProviderHealthBadge', () => {
  it('renders green dot and label for "healthy" status', () => {
    render(<ProviderHealthBadge status="healthy" />);

    expect(screen.getByText('healthy')).toBeDefined();
    const dot = screen.getByTestId('health-dot');
    expect(dot.style.backgroundColor).toBe('rgb(76, 175, 80)');
  });

  it('renders yellow dot for "degraded" status', () => {
    render(<ProviderHealthBadge status="degraded" />);

    expect(screen.getByText('degraded')).toBeDefined();
    const dot = screen.getByTestId('health-dot');
    expect(dot.style.backgroundColor).toBe('rgb(255, 179, 0)');
  });

  it('renders red dot for "unhealthy" status', () => {
    render(<ProviderHealthBadge status="unhealthy" />);

    expect(screen.getByText('unhealthy')).toBeDefined();
    const dot = screen.getByTestId('health-dot');
    expect(dot.style.backgroundColor).toBe('rgb(255, 82, 82)');
  });

  it('renders red dot for "unknown" status', () => {
    render(<ProviderHealthBadge status="unknown" />);

    expect(screen.getByText('unknown')).toBeDefined();
    const dot = screen.getByTestId('health-dot');
    expect(dot.style.backgroundColor).toBe('rgb(255, 82, 82)');
  });
});
