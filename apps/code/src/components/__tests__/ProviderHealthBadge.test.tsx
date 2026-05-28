import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProviderHealthBadge } from '../ProviderHealthBadge';

// jsdom does not resolve CSS variables, so we assert the theme color CLASS
// applied to the status dot rather than a computed RGB value.
describe('ProviderHealthBadge', () => {
  it('renders ok-class dot and label for "healthy" status', () => {
    render(<ProviderHealthBadge status="healthy" />);

    expect(screen.getByText('healthy')).toBeDefined();
    const dot = screen.getByTestId('health-dot');
    expect(dot.className).toContain('cok');
  });

  it('renders warn-class dot for "degraded" status', () => {
    render(<ProviderHealthBadge status="degraded" />);

    expect(screen.getByText('degraded')).toBeDefined();
    const dot = screen.getByTestId('health-dot');
    expect(dot.className).toContain('cwarn');
  });

  it('renders err-class dot for "unhealthy" status', () => {
    render(<ProviderHealthBadge status="unhealthy" />);

    expect(screen.getByText('unhealthy')).toBeDefined();
    const dot = screen.getByTestId('health-dot');
    expect(dot.className).toContain('cerr');
  });

  it('renders err-class dot for "unknown" status', () => {
    render(<ProviderHealthBadge status="unknown" />);

    expect(screen.getByText('unknown')).toBeDefined();
    const dot = screen.getByTestId('health-dot');
    expect(dot.className).toContain('cerr');
  });
});
