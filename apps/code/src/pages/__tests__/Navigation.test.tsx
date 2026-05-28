import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../App';

// Mock the pages to avoid their dependency chains
vi.mock('../ConsolePage', () => ({
  ConsolePage: () => <div>ConsolePage</div>,
}));

vi.mock('../SpacesPage', () => ({
  SpacesPage: () => <div>SpacesPage</div>,
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
    render(<App />);

    fireEvent.click(screen.getByText('[2] Spaces'));

    expect(screen.getByText('SpacesPage')).toBeDefined();
  });

  it('navigates back to ConsolePage when clicking Console tab', () => {
    render(<App />);

    // Go to Spaces
    fireEvent.click(screen.getByText('[2] Spaces'));
    expect(screen.getByText('SpacesPage')).toBeDefined();

    // Back to Console
    fireEvent.click(screen.getByText('[1] Console'));
    expect(screen.getByText('ConsolePage')).toBeDefined();
  });

  it('highlights the active tab', () => {
    render(<App />);

    const consoleTab = screen.getByText('[1] Console');
    const spacesTab = screen.getByText('[2] Spaces');

    // Console should be active initially
    expect(consoleTab.style.opacity).toBe('1');
    expect(spacesTab.style.opacity).toBe('0.5');

    // Click Spaces
    fireEvent.click(spacesTab);
    expect(spacesTab.style.opacity).toBe('1');
    expect(consoleTab.style.opacity).toBe('0.5');
  });
});
