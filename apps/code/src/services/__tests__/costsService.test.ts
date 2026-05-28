import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../apiClient', () => ({
  apiFetch: vi.fn(),
}));

import { getCostSummary, getCostLimits } from '../costsService';
import { apiFetch } from '../apiClient';

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe('costsService', () => {
  it('getCostSummary() calls GET /api/costs/summary and returns parsed JSON', async () => {
    const mockSummary = {
      today: { totalCost: 1.5, totalTokens: 1000, requestCount: 5 },
      thisWeek: { totalCost: 3.0, totalTokens: 2000, requestCount: 10 },
      thisMonth: { totalCost: 10.0, totalTokens: 8000, requestCount: 40 },
      allTime: { totalCost: 50.0, totalTokens: 40000, requestCount: 200 },
      byProvider: { azure: { totalCost: 30.0, totalTokens: 25000 } },
      byModel: { 'gpt-4': { totalCost: 40.0, totalTokens: 30000 } },
      limits: null,
    };
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve(mockSummary),
    } as unknown as Response);

    const result = await getCostSummary();

    expect(apiFetch).toHaveBeenCalledWith('/api/costs/summary');
    expect(result).toEqual(mockSummary);
  });

  it('getCostLimits() calls GET /api/costs/limits and returns parsed JSON', async () => {
    const mockLimits = {
      maxPerSession: null,
      maxPerDay: { value: 5.0, enforcement: 'block', autoResume: false },
      maxPerWeek: null,
      maxPerMonth: { value: 100.0, enforcement: 'warn', autoResume: true },
    };
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve(mockLimits),
    } as unknown as Response);

    const result = await getCostLimits();

    expect(apiFetch).toHaveBeenCalledWith('/api/costs/limits');
    expect(result).toEqual(mockLimits);
  });
});
