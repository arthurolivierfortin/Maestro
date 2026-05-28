import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../services/blockService', () => ({
  getBlock: vi.fn(),
  getBlockContent: vi.fn(),
}));

import { useBlockDetail } from '../useBlockDetail';
import { getBlock, getBlockContent } from '../../services/blockService';
import type { BlockDto } from '../../services/blockService';

const block: BlockDto = {
  id: 'json-validator',
  name: 'JSON Validator',
  blockType: 'tool',
  description: 'Validates JSON',
  isAtomic: true,
  tags: [],
};

beforeEach(() => {
  vi.mocked(getBlock).mockReset();
  vi.mocked(getBlockContent).mockReset();
});

describe('useBlockDetail', () => {
  it('loads metadata, the first-resolving config candidate, and the system prompt', async () => {
    vi.mocked(getBlock).mockResolvedValue(block);
    vi.mocked(getBlockContent).mockImplementation(async (_id, filePath) => {
      if (filePath === 'json-validator.tool.block.json') return '{"id":"json-validator"}';
      if (filePath === 'system-prompt.md') return '# prompt';
      return null;
    });

    const { result } = renderHook(() => useBlockDetail('json-validator'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getBlock).toHaveBeenCalledWith('json-validator');
    expect(result.current.block).toEqual(block);
    expect(result.current.configContent).toBe('{"id":"json-validator"}');
    expect(result.current.promptContent).toBe('# prompt');
    expect(result.current.error).toBeNull();
  });

  it('keeps cleared state when blockId is null', async () => {
    const { result } = renderHook(() => useBlockDetail(null));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getBlock).not.toHaveBeenCalled();
    expect(result.current.block).toBeNull();
    expect(result.current.configContent).toBeNull();
    expect(result.current.promptContent).toBeNull();
  });

  it('falls back to <id>.block.json and tolerates a 404 system prompt', async () => {
    vi.mocked(getBlock).mockResolvedValue(block);
    vi.mocked(getBlockContent).mockImplementation(async (_id, filePath) => {
      if (filePath === 'json-validator.tool.block.json') return null; // first candidate absent
      if (filePath === 'json-validator.block.json') return '{"id":"x"}'; // fallback present
      if (filePath === 'system-prompt.md') return null; // prompt absent
      return null;
    });

    const { result } = renderHook(() => useBlockDetail('json-validator'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.configContent).toBe('{"id":"x"}');
    expect(result.current.promptContent).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets error when the metadata fetch fails', async () => {
    vi.mocked(getBlock).mockRejectedValue(new Error('Block not found'));

    const { result } = renderHook(() => useBlockDetail('missing'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Block not found');
    expect(result.current.block).toBeNull();
  });
});
