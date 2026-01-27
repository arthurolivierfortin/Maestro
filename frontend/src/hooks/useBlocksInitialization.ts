/**
 * useBlocksInitialization Hook
 *
 * Fetches blocks from the backend API and populates the local blockStore.
 * This bridges the gap between backend data and frontend state.
 */

import { useEffect, useState, useCallback } from 'react';
import { useBlockStore } from '../store/blockStore';
import { apiClient } from '../services/api';
import type { Block, BlockType } from '../types/block.types';

/**
 * Backend block DTO format
 */
interface BackendBlockDto {
  id: string;
  name: string;
  blockType: string;
  description: string | null;
  version: string;
  isAtomic: boolean;
  tags: string[];
  capabilities: string[];
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  sourcePath: string | null;
}

/**
 * Convert backend DTO to frontend Block type
 */
function convertBackendBlock(dto: BackendBlockDto): Block {
  return {
    id: dto.id,
    name: dto.name,
    blockType: dto.blockType as BlockType,
    isAtomic: dto.isAtomic,
    capabilities: dto.capabilities || [],
    config: dto.config || {},
    metadata: {
      description: dto.description || undefined,
      tags: dto.tags || [],
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      status: 'active',
      version: dto.version,
      sourcePath: dto.metadata?._sourcePath as string | undefined,
    },
    children: [],
    connections: [],
  };
}

/**
 * Hook return type
 */
interface UseBlocksInitializationResult {
  isLoading: boolean;
  error: string | null;
  blocksCount: number;
  refresh: () => Promise<void>;
  lastFetched: Date | null;
}

/**
 * Hook to initialize blocks from the backend
 */
export function useBlocksInitialization(): UseBlocksInitializationResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const { setBlocks, blocks } = useBlockStore();

  const fetchBlocks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const backendBlocks = await apiClient.get<BackendBlockDto[]>('/api/discovery/blocks');

      if (backendBlocks && backendBlocks.length > 0) {
        // Convert to frontend format
        const convertedBlocks = backendBlocks.map(convertBackendBlock);

        // Create a Map for the block store
        const blocksMap = new Map<string, Block>();
        convertedBlocks.forEach((block) => {
          blocksMap.set(block.id, block);
        });

        // Update the store
        setBlocks(blocksMap, null);
        console.log(`[BlocksInit] Loaded ${convertedBlocks.length} blocks from backend`);
      } else {
        console.log('[BlocksInit] No blocks returned from backend');
      }

      setLastFetched(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch blocks';
      setError(message);
      console.error('[BlocksInit] Error fetching blocks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [setBlocks]);

  // Auto-fetch on mount if store is empty
  useEffect(() => {
    if (blocks.size === 0) {
      fetchBlocks();
    }
  }, [blocks.size, fetchBlocks]);

  return {
    isLoading,
    error,
    blocksCount: blocks.size,
    refresh: fetchBlocks,
    lastFetched,
  };
}

export default useBlocksInitialization;
