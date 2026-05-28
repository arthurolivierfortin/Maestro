import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../apiClient', () => ({
  apiFetch: vi.fn(),
}));

import { getBlocks } from '../blockService';
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
});
