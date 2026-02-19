/**
 * Favorites Hook
 *
 * Manages favorite blocks with localStorage persistence.
 */

import { useCallback } from 'react';
import { useBlockStore } from '../store/blockStore';

const FAVORITES_STORAGE_KEY = 'maestro_favorites';

/**
 * Get favorites from localStorage
 */
function loadFavorites(): Set<string> {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!stored) return new Set();

    const ids: string[] = JSON.parse(stored);
    return new Set(ids);
  } catch (error) {
    console.error('Failed to load favorites:', error);
    return new Set();
  }
}

/**
 * Save favorites to localStorage
 */
function saveFavorites(favoriteIds: Set<string>): void {
  try {
    const ids = Array.from(favoriteIds);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
  } catch (error) {
    console.error('Failed to save favorites:', error);
  }
}

/**
 * Favorites management hook
 */
export function useFavorites() {
  const getAllBlocks = useBlockStore((state) => state.getAllBlocks);
  const updateBlock = useBlockStore((state) => state.updateBlock);

  const toggleFavorite = useCallback(
    (blockId: string) => {
      const blocks = getAllBlocks();
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;

      const newFavoriteState = !block.isFavorite;

      // Update block
      updateBlock(blockId, { isFavorite: newFavoriteState });

      // Update localStorage
      const favorites = loadFavorites();
      if (newFavoriteState) {
        favorites.add(blockId);
      } else {
        favorites.delete(blockId);
      }
      saveFavorites(favorites);
    },
    [getAllBlocks, updateBlock]
  );

  const getFavorites = useCallback(() => {
    return getAllBlocks().filter((b) => b.isFavorite);
  }, [getAllBlocks]);

  const isFavorite = useCallback(
    (blockId: string) => {
      const blocks = getAllBlocks();
      const block = blocks.find((b) => b.id === blockId);
      return block?.isFavorite || false;
    },
    [getAllBlocks]
  );

  return {
    toggleFavorite,
    getFavorites,
    isFavorite,
    favoriteCount: getAllBlocks().filter((b) => b.isFavorite).length,
  };
}
