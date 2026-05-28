import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../../App';

function tab(container: HTMLElement, label: string): HTMLElement {
  const found = Array.from(container.querySelectorAll<HTMLElement>('.tab')).find(
    (el) => within(el).queryByText(label) !== null
  );
  if (!found) throw new Error(`tab "${label}" not found`);
  return found;
}

// Mock the pages to avoid their dependency chains
vi.mock('../ConsolePage', () => ({
  ConsolePage: () => <div>ConsolePage</div>,
}));

vi.mock('../SpacesPage', () => ({
  SpacesPage: () => <div>SpacesPage</div>,
}));

vi.mock('../CatalogPage', () => ({
  CatalogPage: () => <div>CatalogPage</div>,
}));

vi.mock('../ModelsPage', () => ({
  ModelsPage: () => <div>ModelsPage</div>,
}));

vi.mock('../MonitorPage', () => ({
  MonitorPage: () => <div>MonitorPage</div>,
}));

// Mock useBackendStatus
vi.mock('../../hooks/useBackendStatus', () => ({
  useBackendStatus: () => ({ connected: true, checking: false }),
}));

describe('Navigation', () => {
  it('renders ConsolePage by default', () => {
    render(<App />);
    expect(screen.getByText('ConsolePage')).toBeDefined();
  });

  it('navigates to SpacesPage when clicking Spaces tab', () => {
    const { container } = render(<App />);

    fireEvent.click(tab(container, 'Spaces'));

    expect(screen.getByText('SpacesPage')).toBeDefined();
  });

  it('navigates back to ConsolePage when clicking Console tab', () => {
    const { container } = render(<App />);

    // Go to Spaces
    fireEvent.click(tab(container, 'Spaces'));
    expect(screen.getByText('SpacesPage')).toBeDefined();

    // Back to Console
    fireEvent.click(tab(container, 'Console'));
    expect(screen.getByText('ConsolePage')).toBeDefined();
  });

  it('navigates to CatalogPage when clicking Catalog tab', () => {
    const { container } = render(<App />);

    fireEvent.click(tab(container, 'Catalog'));

    expect(screen.getByText('CatalogPage')).toBeDefined();
  });

  it('navigates to ModelsPage when clicking Models tab', () => {
    const { container } = render(<App />);

    fireEvent.click(tab(container, 'Models'));

    expect(screen.getByText('ModelsPage')).toBeDefined();
  });

  it('navigates to MonitorPage when clicking Monitor tab', () => {
    const { container } = render(<App />);

    fireEvent.click(tab(container, 'Monitor'));

    expect(screen.getByText('MonitorPage')).toBeDefined();
  });

  it('highlights the active tab', () => {
    const { container } = render(<App />);

    const consoleTab = tab(container, 'Console');
    const spacesTab = tab(container, 'Spaces');

    // Console should be active initially
    expect(consoleTab.className).toContain('active');
    expect(spacesTab.className).not.toContain('active');

    // Click Spaces
    fireEvent.click(spacesTab);
    expect(tab(container, 'Spaces').className).toContain('active');
    expect(tab(container, 'Console').className).not.toContain('active');
  });
});
