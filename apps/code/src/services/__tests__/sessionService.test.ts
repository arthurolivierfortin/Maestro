import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../apiClient', () => ({
  apiFetch: vi.fn(),
}));

import { getSessions, startSession, stopSession } from '../sessionService';
import { apiFetch } from '../apiClient';

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe('sessionService', () => {
  it('getSessions calls GET /api/sessions and returns parsed JSON', async () => {
    const mockSessions = [{ id: 's1', name: 'Test', status: 'active' }];
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve(mockSessions),
    } as unknown as Response);

    const result = await getSessions();

    expect(apiFetch).toHaveBeenCalledWith('/api/sessions');
    expect(result).toEqual(mockSessions);
  });

  it('startSession calls POST /api/sessions/{id}/start', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve({ id: 's1', status: 'active' }),
    } as unknown as Response);

    await startSession('s1');

    expect(apiFetch).toHaveBeenCalledWith('/api/sessions/s1/start', { method: 'POST' });
  });

  it('stopSession calls POST /api/sessions/{id}/stop', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve({ id: 's1', status: 'stopped' }),
    } as unknown as Response);

    await stopSession('s1');

    expect(apiFetch).toHaveBeenCalledWith('/api/sessions/s1/stop', { method: 'POST' });
  });
});
