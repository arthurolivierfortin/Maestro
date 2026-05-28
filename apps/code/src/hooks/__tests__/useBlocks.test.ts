import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../services/blockService', () => ({
  getBlocks: vi.fn(),
}));

import { useBlocks } from '../useBlocks';
import { getBlocks } from '../../services/blockService';

beforeEach(() => {
  vi.mocked(getBlocks).mockReset();
});

describe('useBlocks', () => {
  it('fetches blocks on mount and exposes them', async () => {
    const mockBlocks = [
      { id: 'b1', name: 'Test Block', blockType: 'prompt', description: 'A test', isAtomic: true, tags: [] },
    ];
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);

    const { result } = renderHook(() => useBlocks());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getBlocks).toHaveBeenCalledWith({ type: undefined, search: undefined });
    expect(result.current.blocks).toEqual(mockBlocks);
    expect(result.current.error).toBeNull();
  });

  it('re-fetches when typeFilter changes', async () => {
    vi.mocked(getBlocks).mockResolvedValue([]);

    const { result } = renderHook(() => useBlocks());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getBlocks).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setTypeFilter('agent');
    });

    await waitFor(() => {
      expect(getBlocks).toHaveBeenCalledTimes(2);
    });

    expect(getBlocks).toHaveBeenLastCalledWith({ type: 'agent', search: undefined });
    expect(result.current.typeFilter).toBe('agent');
  });

  it('re-fetches when searchQuery changes', async () => {
    vi.mocked(getBlocks).mockResolvedValue([]);

    const { result } = renderHook(() => useBlocks());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSearchQuery('git');
    });

    await waitFor(() => {
      expect(getBlocks).toHaveBeenCalledTimes(2);
    });

    expect(getBlocks).toHaveBeenLastCalledWith({ type: undefined, search: 'git' });
    expect(result.current.searchQuery).toBe('git');
  });

  it('sets error when fetch fails', async () => {
    vi.mocked(getBlocks).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBlocks());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.blocks).toEqual([]);
  });
});
