import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/workspaceService', () => ({
  getWorkspaces: vi.fn(),
}));

import { useWorkspaces } from '../useWorkspaces';
import { getWorkspaces } from '../../services/workspaceService';

beforeEach(() => {
  vi.mocked(getWorkspaces).mockReset();
});

describe('useWorkspaces', () => {
  it('fetches workspaces on mount and exposes them', async () => {
    const mockWorkspaces = [
      { id: 'w1', name: 'Dev', type: 'Custom', status: 'Active', sessionIds: ['s1'], projectIds: [], createdAt: '2026-01-01' },
    ];
    vi.mocked(getWorkspaces).mockResolvedValue(mockWorkspaces);

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    expect(getWorkspaces).toHaveBeenCalledTimes(1);
    expect(result.current.workspaces).toEqual(mockWorkspaces);
    expect(result.current.isLoading).toBe(false);
  });

  it('sets error when fetch fails', async () => {
    vi.mocked(getWorkspaces).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.workspaces).toEqual([]);
  });

  it('starts with isLoading true', () => {
    vi.mocked(getWorkspaces).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useWorkspaces());

    expect(result.current.isLoading).toBe(true);
  });
});
