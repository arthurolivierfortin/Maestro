import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogPage } from '../CatalogPage';

const mockSetTypeFilter = vi.fn();
const mockSetSearchQuery = vi.fn();

vi.mock('../../hooks/useBlocks', () => ({
  useBlocks: vi.fn(),
}));

vi.mock('../../hooks/useBlockDetail', () => ({
  useBlockDetail: vi.fn(),
}));

import { useBlocks } from '../../hooks/useBlocks';
import { useBlockDetail } from '../../hooks/useBlockDetail';

const twoBlocks = [
  { id: 'b1', name: 'Git Commit Agent', blockType: 'agent', description: 'Commits code', isAtomic: false, tags: [] },
  { id: 'b2', name: 'File Write Tool', blockType: 'tool', description: 'Writes files', isAtomic: true, tags: [] },
];

beforeEach(() => {
  mockSetTypeFilter.mockReset();
  mockSetSearchQuery.mockReset();
  vi.mocked(useBlocks).mockReturnValue({
    blocks: [],
    isLoading: false,
    error: null,
    typeFilter: undefined,
    searchQuery: undefined,
    setTypeFilter: mockSetTypeFilter,
    setSearchQuery: mockSetSearchQuery,
  });
  // Default: no detail loaded. Tests that select a block override per blockId.
  vi.mocked(useBlockDetail).mockReturnValue({
    block: null,
    configContent: null,
    promptContent: null,
    isLoading: false,
    error: null,
  });
});

describe('CatalogPage', () => {
  it('renders type filter buttons', () => {
    render(<CatalogPage />);

    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('Agents')).toBeDefined();
    expect(screen.getByText('Tools')).toBeDefined();
    expect(screen.getByText('Workflows')).toBeDefined();
    expect(screen.getByText('Prompts')).toBeDefined();
  });

  it('renders block cards when blocks exist', () => {
    vi.mocked(useBlocks).mockReturnValue({
      blocks: [
        { id: 'b1', name: 'Git Commit Agent', blockType: 'agent', description: 'Commits code', isAtomic: false, tags: [] },
        { id: 'b2', name: 'File Write Tool', blockType: 'tool', description: 'Writes files', isAtomic: true, tags: [] },
      ],
      isLoading: false,
      error: null,
      typeFilter: undefined,
      searchQuery: undefined,
      setTypeFilter: mockSetTypeFilter,
      setSearchQuery: mockSetSearchQuery,
    });

    render(<CatalogPage />);

    expect(screen.getByText('Git Commit Agent')).toBeDefined();
    expect(screen.getByText('File Write Tool')).toBeDefined();
  });

  it('shows loading state', () => {
    vi.mocked(useBlocks).mockReturnValue({
      blocks: [],
      isLoading: true,
      error: null,
      typeFilter: undefined,
      searchQuery: undefined,
      setTypeFilter: mockSetTypeFilter,
      setSearchQuery: mockSetSearchQuery,
    });

    render(<CatalogPage />);

    expect(screen.getByText('Loading blocks...')).toBeDefined();
  });

  it('shows error state', () => {
    vi.mocked(useBlocks).mockReturnValue({
      blocks: [],
      isLoading: false,
      error: 'Connection failed',
      typeFilter: undefined,
      searchQuery: undefined,
      setTypeFilter: mockSetTypeFilter,
      setSearchQuery: mockSetSearchQuery,
    });

    render(<CatalogPage />);

    expect(screen.getByText('Error: Connection failed')).toBeDefined();
  });

  it('shows empty state when no blocks', () => {
    render(<CatalogPage />);

    expect(screen.getByText('No blocks found.')).toBeDefined();
  });

  it('calls setTypeFilter when clicking a filter button', () => {
    render(<CatalogPage />);

    fireEvent.click(screen.getByText('Agents'));

    expect(mockSetTypeFilter).toHaveBeenCalledWith('agent');
  });

  it('calls setTypeFilter with undefined when clicking All', () => {
    vi.mocked(useBlocks).mockReturnValue({
      blocks: [],
      isLoading: false,
      error: null,
      typeFilter: 'agent',
      searchQuery: undefined,
      setTypeFilter: mockSetTypeFilter,
      setSearchQuery: mockSetSearchQuery,
    });

    render(<CatalogPage />);

    fireEvent.click(screen.getByText('All'));

    expect(mockSetTypeFilter).toHaveBeenCalledWith(undefined);
  });

  it('renders search input', () => {
    render(<CatalogPage />);

    const searchInput = screen.getByPlaceholderText('Search blocks...');
    expect(searchInput).toBeDefined();
  });

  it('shows the detail panel when a block row is clicked', () => {
    vi.mocked(useBlocks).mockReturnValue({
      blocks: twoBlocks,
      isLoading: false,
      error: null,
      typeFilter: undefined,
      searchQuery: undefined,
      setTypeFilter: mockSetTypeFilter,
      setSearchQuery: mockSetSearchQuery,
    });
    vi.mocked(useBlockDetail).mockImplementation((id: string | null) =>
      id === 'b1'
        ? { block: twoBlocks[0], configContent: null, promptContent: null, isLoading: false, error: null }
        : { block: null, configContent: null, promptContent: null, isLoading: false, error: null }
    );

    render(<CatalogPage />);

    fireEvent.click(screen.getByText('Git Commit Agent'));

    // detail panel renders the block id and a Close button
    expect(screen.getByText('b1')).toBeDefined();
    expect(screen.getByText('Close')).toBeDefined();
  });

  it('closes the detail panel when Close is clicked', () => {
    vi.mocked(useBlocks).mockReturnValue({
      blocks: twoBlocks,
      isLoading: false,
      error: null,
      typeFilter: undefined,
      searchQuery: undefined,
      setTypeFilter: mockSetTypeFilter,
      setSearchQuery: mockSetSearchQuery,
    });
    vi.mocked(useBlockDetail).mockImplementation((id: string | null) =>
      id === 'b1'
        ? { block: twoBlocks[0], configContent: null, promptContent: null, isLoading: false, error: null }
        : { block: null, configContent: null, promptContent: null, isLoading: false, error: null }
    );

    render(<CatalogPage />);

    fireEvent.click(screen.getByText('Git Commit Agent'));
    expect(screen.getByText('Close')).toBeDefined();

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Close')).toBeNull();
  });
});
