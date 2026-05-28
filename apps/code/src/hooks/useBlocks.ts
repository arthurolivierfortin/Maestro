import { useState, useEffect, useCallback } from 'react';
import { getBlocks as fetchBlocks } from '../services/blockService';
import type { BlockDto } from '../services/blockService';

export function useBlocks() {
  const [blocks, setBlocks] = useState<BlockDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined);

  const loadBlocks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchBlocks({ type: typeFilter, search: searchQuery });
      setBlocks(data);
      setError(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load blocks';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, searchQuery]);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  return {
    blocks,
    isLoading,
    error,
    typeFilter,
    searchQuery,
    setTypeFilter,
    setSearchQuery,
  };
}
