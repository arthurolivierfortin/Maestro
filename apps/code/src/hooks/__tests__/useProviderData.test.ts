import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../services/providerService', () => ({
  getHealth: vi.fn(),
  getModels: vi.fn(),
  getActiveProvider: vi.fn(),
  getStats: vi.fn(),
}));

import { useProviderData } from '../useProviderData';
import { getHealth, getModels, getActiveProvider, getStats } from '../../services/providerService';

const mockHealth = { status: 'healthy', activeModel: 'gpt-4', modelsLoaded: 1, device: 'cpu', cudaAvailable: false, cudaDeviceName: null };
const mockModels = { hardware: null, summary: null, count: 0, models: [] };
const mockActive = { provider: 'llm-provider', gatewayType: 'LLMProviderGateway' };
const mockStats = { totalRequests: 10, totalErrors: 0, errorRate: 0, promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyP50Ms: 0, latencyP95Ms: 0, latencyP99Ms: 0, avgLatencyMs: 0, perModel: [] };

beforeEach(() => {
  vi.mocked(getHealth).mockReset();
  vi.mocked(getModels).mockReset();
  vi.mocked(getActiveProvider).mockReset();
  vi.mocked(getStats).mockReset();

  vi.mocked(getHealth).mockResolvedValue(mockHealth);
  vi.mocked(getModels).mockResolvedValue(mockModels);
  vi.mocked(getActiveProvider).mockResolvedValue(mockActive);
  vi.mocked(getStats).mockResolvedValue(mockStats);
});

describe('useProviderData', () => {
  it('fetches all endpoints on mount and exposes data', async () => {
    const { result } = renderHook(() => useProviderData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getHealth).toHaveBeenCalledTimes(1);
    expect(getModels).toHaveBeenCalledTimes(1);
    expect(getActiveProvider).toHaveBeenCalledTimes(1);
    expect(getStats).toHaveBeenCalledTimes(1);
    expect(result.current.health?.status).toBe('healthy');
    expect(result.current.models).toEqual(mockModels);
    expect(result.current.activeProvider?.provider).toBe('llm-provider');
    expect(result.current.stats?.totalRequests).toBe(10);
    expect(result.current.error).toBeNull();
  });

  it('sets error when a fetch fails', async () => {
    vi.mocked(getHealth).mockRejectedValue(new Error('Connection refused'));

    const { result } = renderHook(() => useProviderData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Connection refused');
  });

  it('cleans up interval on unmount (no leak)', async () => {
    const clearSpy = vi.spyOn(global, 'clearInterval');

    const { result, unmount } = renderHook(() => useProviderData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    unmount();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useProviderData());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.health).toBeNull();
    expect(result.current.models).toBeNull();
    expect(result.current.activeProvider).toBeNull();
    expect(result.current.stats).toBeNull();
  });
});
