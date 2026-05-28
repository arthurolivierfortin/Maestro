import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../apiClient', () => ({
  apiFetch: vi.fn(),
}));

import { getWorkspaces } from '../workspaceService';
import { apiFetch } from '../apiClient';

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe('workspaceService', () => {
  it('getWorkspaces calls GET /api/workspaces and returns parsed JSON', async () => {
    const mockWorkspaces = [
      { id: 'w1', name: 'Dev', type: 'Custom', status: 'Active', sessionIds: ['s1'], projectIds: [] },
    ];
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve(mockWorkspaces),
    } as unknown as Response);

    const result = await getWorkspaces();

    expect(apiFetch).toHaveBeenCalledWith('/api/workspaces');
    expect(result).toEqual(mockWorkspaces);
  });
});
