import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../apiClient', () => ({
  apiFetch: vi.fn(),
}));

import { getHealth, getModels, getActiveProvider, getStats } from '../providerService';
import { apiFetch } from '../apiClient';

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe('providerService', () => {
  it('getHealth() calls GET /api/provider/health and returns parsed JSON', async () => {
    const mockHealth = { status: 'healthy', activeModel: 'gpt-4', modelsLoaded: 1, device: 'cpu', cudaAvailable: false, cudaDeviceName: null };
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve(mockHealth),
    } as unknown as Response);

    const result = await getHealth();

    expect(apiFetch).toHaveBeenCalledWith('/api/provider/health');
    expect(result).toEqual(mockHealth);
  });

  it('getModels() calls GET /api/provider/models and returns parsed JSON', async () => {
    const mockModels = { hardware: null, summary: null, count: 0, models: [] };
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve(mockModels),
    } as unknown as Response);

    const result = await getModels();

    expect(apiFetch).toHaveBeenCalledWith('/api/provider/models');
    expect(result).toEqual(mockModels);
  });

  it('getActiveProvider() calls GET /api/provider/active and returns parsed JSON', async () => {
    const mockActive = { provider: 'llm-provider', gatewayType: 'LLMProviderGateway' };
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve(mockActive),
    } as unknown as Response);

    const result = await getActiveProvider();

    expect(apiFetch).toHaveBeenCalledWith('/api/provider/active');
    expect(result).toEqual(mockActive);
  });

  it('getStats() calls GET /api/provider/stats and returns parsed JSON', async () => {
    const mockStats = { totalRequests: 100, totalErrors: 2, errorRate: 0.02, promptTokens: 500, completionTokens: 300, totalTokens: 800, latencyP50Ms: 10, latencyP95Ms: 50, latencyP99Ms: 100, avgLatencyMs: 25, perModel: [] };
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve(mockStats),
    } as unknown as Response);

    const result = await getStats();

    expect(apiFetch).toHaveBeenCalledWith('/api/provider/stats');
    expect(result).toEqual(mockStats);
  });
});
