import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../services/costsService', () => ({
  getCostSummary: vi.fn(),
  getCostLimits: vi.fn(),
}));

import { useCostData } from '../useCostData';
import { getCostSummary, getCostLimits } from '../../services/costsService';

const mockSummary = {
  today: { totalCost: 1.5, totalTokens: 1000, requestCount: 5 },
  thisWeek: { totalCost: 3.0, totalTokens: 2000, requestCount: 10 },
  thisMonth: { totalCost: 10.0, totalTokens: 8000, requestCount: 40 },
  allTime: { totalCost: 50.0, totalTokens: 40000, requestCount: 200 },
  byProvider: {},
  byModel: {},
  limits: null,
};

const mockLimits = {
  maxPerSession: null,
  maxPerDay: { value: 5.0, enforcement: 'block', autoResume: false },
  maxPerWeek: null,
  maxPerMonth: null,
};

beforeEach(() => {
  vi.mocked(getCostSummary).mockReset();
  vi.mocked(getCostLimits).mockReset();

  vi.mocked(getCostSummary).mockResolvedValue(mockSummary);
  vi.mocked(getCostLimits).mockResolvedValue(mockLimits);
});

describe('useCostData', () => {
  it('fetches summary and limits on mount and exposes data', async () => {
    const { result } = renderHook(() => useCostData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getCostSummary).toHaveBeenCalledTimes(1);
    expect(getCostLimits).toHaveBeenCalledTimes(1);
    expect(result.current.summary?.today.totalCost).toBe(1.5);
    expect(result.current.limits?.maxPerDay?.value).toBe(5.0);
    expect(result.current.error).toBeNull();
  });

  it('sets error when a fetch fails', async () => {
    vi.mocked(getCostSummary).mockRejectedValue(new Error('Connection refused'));

    const { result } = renderHook(() => useCostData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Connection refused');
  });

  it('cleans up interval on unmount (no leak)', async () => {
    const clearSpy = vi.spyOn(global, 'clearInterval');

    const { result, unmount } = renderHook(() => useCostData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    unmount();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useCostData());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.summary).toBeNull();
    expect(result.current.limits).toBeNull();
  });
});
