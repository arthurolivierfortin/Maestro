import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from '../apiClient';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('calls fetch with the correct URL', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as unknown as Response);

    await apiFetch('/api/test');

    expect(mockFetch).toHaveBeenCalledWith('/api/test', undefined);
  });

  it('throws on non-ok response with JSON error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'Resource not found' }),
    } as unknown as Response);

    await expect(apiFetch('/api/missing')).rejects.toThrow('Resource not found');
  });

  it('throws with statusText when JSON parse fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('invalid json')),
    } as unknown as Response);

    await expect(apiFetch('/api/broken')).rejects.toThrow('Internal Server Error');
  });
});
