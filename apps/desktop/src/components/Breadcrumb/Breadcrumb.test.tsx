/**
 * Breadcrumb Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Breadcrumb } from './Breadcrumb';
import { useNavigationStore } from '../../store/navigationStore';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the block store
vi.mock('../../store/blockStore', () => ({
  useBlockStore: vi.fn((selector) => {
    const state = {
      blocks: new Map([
        ['block-1', { id: 'block-1', name: 'Test Block', blockType: 'agent' }],
      ]),
    };
    return selector(state);
  }),
}));

describe('Breadcrumb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset navigation store
    useNavigationStore.setState({
      navStack: [
        { type: 'page', id: 'foundry', label: 'Foundry', path: '/foundry' },
      ],
      selectedBlockId: null,
      propertiesPanelMode: 'view',
    });
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it('should render Home segment', () => {
    renderWithRouter(<Breadcrumb />);
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
  });

  it('should render page segment from navigation stack', () => {
    renderWithRouter(<Breadcrumb />);
    expect(screen.getByText('Foundry')).toBeInTheDocument();
  });

  it('should render multiple segments when navigating into blocks', () => {
    useNavigationStore.setState({
      navStack: [
        { type: 'page', id: 'foundry', label: 'Foundry', path: '/foundry' },
        { type: 'block', id: 'block-1', label: 'Block 1', path: '/canvas/block-1', blockId: 'block-1', isAtomic: false },
      ],
      selectedBlockId: null,
      propertiesPanelMode: 'view',
    });

    renderWithRouter(<Breadcrumb />);
    expect(screen.getByText('Foundry')).toBeInTheDocument();
    expect(screen.getByText('Block 1')).toBeInTheDocument();
  });

  it('should have back and forward navigation buttons', () => {
    renderWithRouter(<Breadcrumb />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go forward/i })).toBeInTheDocument();
  });

  it('should navigate to home when Home segment is clicked', () => {
    renderWithRouter(<Breadcrumb />);
    const homeButton = screen.getByRole('button', { name: /home/i });
    fireEvent.click(homeButton);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should mark the last segment as current with aria-current', () => {
    renderWithRouter(<Breadcrumb />);
    const foundryButton = screen.getByText('Foundry').closest('button');
    expect(foundryButton).toHaveAttribute('aria-current', 'page');
  });
});
