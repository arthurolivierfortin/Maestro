/**
 * Recent Items Tracking
 *
 * Tracks recently accessed items in localStorage.
 */

export interface RecentItem {
  id: string;
  name: string;
  type: 'block' | 'workflow' | 'model';
  accessedAt: string;
}

const STORAGE_KEY = 'maestro_recent_items';
const MAX_RECENT_ITEMS = 10;

/**
 * Get recent items from localStorage
 */
export function getRecentItems(): RecentItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const items: RecentItem[] = JSON.parse(stored);
    return items.slice(0, MAX_RECENT_ITEMS);
  } catch (error) {
    console.error('Failed to load recent items:', error);
    return [];
  }
}

/**
 * Add item to recent items
 */
export function addRecentItem(item: Omit<RecentItem, 'accessedAt'>): void {
  try {
    const recent = getRecentItems();

    // Remove if already exists
    const filtered = recent.filter((r) => r.id !== item.id);

    // Add to front
    const updated: RecentItem[] = [
      { ...item, accessedAt: new Date().toISOString() },
      ...filtered,
    ].slice(0, MAX_RECENT_ITEMS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save recent item:', error);
  }
}

/**
 * Clear all recent items
 */
export function clearRecentItems(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear recent items:', error);
  }
}
