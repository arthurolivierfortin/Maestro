import { useState, useEffect } from 'react';
import { getBlock, getBlockContent } from '../services/blockService';
import type { BlockDto } from '../services/blockService';

export interface BlockDetailState {
  block: BlockDto | null;
  configContent: string | null;
  promptContent: string | null;
  isLoading: boolean;
  error: string | null;
}

const EMPTY: BlockDetailState = {
  block: null,
  configContent: null,
  promptContent: null,
  isLoading: false,
  error: null,
};

/**
 * Loads a block's metadata plus its raw block.json / system-prompt.md content.
 *
 * The block.json filename is not derivable from id+type (the naming convention
 * across content/system/blocks is inconsistent), so we try candidates in order
 * and use the first that resolves. Content fetches are best-effort: a missing
 * file (404 -> null) hides its section and is never surfaced as an error. Only
 * a failed metadata fetch sets `error`.
 */
export function useBlockDetail(blockId: string | null): BlockDetailState {
  const [state, setState] = useState<BlockDetailState>(EMPTY);

  useEffect(() => {
    if (!blockId) {
      setState(EMPTY);
      return;
    }

    let cancelled = false;
    setState({ ...EMPTY, isLoading: true });

    (async () => {
      try {
        const block = await getBlock(blockId);

        const candidates = [`${blockId}.${block.blockType}.block.json`, `${blockId}.block.json`];
        let configContent: string | null = null;
        for (const candidate of candidates) {
          configContent = await getBlockContent(blockId, candidate);
          if (configContent !== null) break;
        }

        const promptContent = await getBlockContent(blockId, 'system-prompt.md');

        if (cancelled) return;
        setState({ block, configContent, promptContent, isLoading: false, error: null });
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'Failed to load block';
        setState({ ...EMPTY, error: message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blockId]);

  return state;
}
