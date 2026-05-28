import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../apiClient', () => ({
  apiFetch: vi.fn(),
  API_URL: '',
}));

import { getBlocks, getBlock, getBlockContent } from '../blockService';
import { apiFetch } from '../apiClient';

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe('blockService', () => {
  it('getBlocks() calls GET /api/blocks and returns parsed JSON', async () => {
    const mockBlocks = [{ id: 'b1', name: 'Test Block', blockType: 'prompt', description: 'A test block' }];
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve(mockBlocks),
    } as unknown as Response);

    const result = await getBlocks();

    expect(apiFetch).toHaveBeenCalledWith('/api/blocks');
    expect(result).toEqual(mockBlocks);
  });

  it('getBlocks({ type: "agent" }) appends ?type=agent', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve([]),
    } as unknown as Response);

    await getBlocks({ type: 'agent' });

    expect(apiFetch).toHaveBeenCalledWith('/api/blocks?type=agent');
  });

  it('getBlocks({ search: "git" }) appends ?search=git', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve([]),
    } as unknown as Response);

    await getBlocks({ search: 'git' });

    expect(apiFetch).toHaveBeenCalledWith('/api/blocks?search=git');
  });

  it('getBlocks({ type: "tool", search: "file" }) appends both params', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve([]),
    } as unknown as Response);

    await getBlocks({ type: 'tool', search: 'file' });

    expect(apiFetch).toHaveBeenCalledWith('/api/blocks?type=tool&search=file');
  });

  it('getBlock(id) calls GET /api/blocks/{id} and returns parsed DTO', async () => {
    const mockBlock = { id: 'b1', name: 'Test Block', blockType: 'agent', description: 'A', isAtomic: false, tags: [] };
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve(mockBlock),
    } as unknown as Response);

    const result = await getBlock('b1');

    expect(apiFetch).toHaveBeenCalledWith('/api/blocks/b1');
    expect(result).toEqual(mockBlock);
  });
});

describe('getBlockContent', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('returns the raw text body on a 2xx response', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{"id":"b1"}'),
    } as unknown as Response);

    const result = await getBlockContent('b1', 'b1.agent.block.json');

    expect(fetchSpy).toHaveBeenCalledWith('/api/blocks/b1/content/b1.agent.block.json');
    expect(result).toBe('{"id":"b1"}');
  });

  it('returns null on a 404 (file absent)', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve(''),
    } as unknown as Response);

    const result = await getBlockContent('b1', 'system-prompt.md');

    expect(result).toBeNull();
  });

  it('throws on a non-404 error status', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('boom'),
    } as unknown as Response);

    await expect(getBlockContent('b1', 'b1.block.json')).rejects.toThrow();
  });
});
