import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from '../App';

vi.mock('../pages/ConsolePage', () => ({
  ConsolePage: () => <div>ConsolePage</div>,
}));
vi.mock('../pages/SpacesPage', () => ({ SpacesPage: () => <div>SpacesPage</div> }));
vi.mock('../pages/CatalogPage', () => ({ CatalogPage: () => <div>CatalogPage</div> }));
vi.mock('../pages/ModelsPage', () => ({ ModelsPage: () => <div>ModelsPage</div> }));
vi.mock('../pages/MonitorPage', () => ({ MonitorPage: () => <div>MonitorPage</div> }));
vi.mock('../hooks/useBackendStatus', () => ({
  useBackendStatus: () => ({ connected: true, checking: false }),
}));

describe('App theme shell', () => {
  it('sets phosphor + crt attributes on documentElement', () => {
    render(<App />);
    expect(document.documentElement.dataset.tui).toBe('amber');
    expect(document.documentElement.dataset.crt).toBe('on');
  });

  it('renders the shell + term wrappers', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.shell')).not.toBeNull();
    expect(container.querySelector('.term')).not.toBeNull();
  });
});
