import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../apiClient', () => ({
  apiFetch: vi.fn(),
}));

import {
  getSessions,
  startSession,
  stopSession,
  createSession,
  getSession,
  pauseSession,
  resumeSession,
  deleteSession,
} from '../sessionService';
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

  it('createSession calls POST /api/sessions with body and returns parsed DTO', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve({ id: 's9', name: 'New', status: 'created' }),
    } as unknown as Response);

    const result = await createSession({ name: 'New', repositoryPath: 'C:/Proj', task: 'do x' });

    expect(apiFetch).toHaveBeenCalledWith('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New', repositoryPath: 'C:/Proj', task: 'do x' }),
    });
    expect(result).toEqual({ id: 's9', name: 'New', status: 'created' });
  });

  it('getSession calls GET /api/sessions/{id} and returns parsed DTO', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve({ id: 's1', name: 'X', status: 'active' }),
    } as unknown as Response);

    const result = await getSession('s1');

    expect(apiFetch).toHaveBeenCalledWith('/api/sessions/s1');
    expect(result).toEqual({ id: 's1', name: 'X', status: 'active' });
  });

  it('pauseSession calls POST /api/sessions/{id}/pause', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve({ id: 's1', status: 'paused' }),
    } as unknown as Response);

    await pauseSession('s1');

    expect(apiFetch).toHaveBeenCalledWith('/api/sessions/s1/pause', { method: 'POST' });
  });

  it('resumeSession calls POST /api/sessions/{id}/resume', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve({ id: 's1', status: 'active' }),
    } as unknown as Response);

    await resumeSession('s1');

    expect(apiFetch).toHaveBeenCalledWith('/api/sessions/s1/resume', { method: 'POST' });
  });

  it('deleteSession calls DELETE /api/sessions/{id} and does not parse body', async () => {
    const json = vi.fn();
    vi.mocked(apiFetch).mockResolvedValue({ json } as unknown as Response);

    await deleteSession('s1');

    expect(apiFetch).toHaveBeenCalledWith('/api/sessions/s1', { method: 'DELETE' });
    expect(json).not.toHaveBeenCalled();
  });
});
