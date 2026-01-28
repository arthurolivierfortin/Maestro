/**
 * TreeExplorer Component
 *
 * Shared tree/file explorer component that provides consistent styling
 * for hierarchical lists like BlockPalette, BlockExplorer, and Models list.
 */

import { useState, useCallback, ReactNode } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import './TreeExplorer.scss';

// Category/Group item
export interface TreeCategory<T = unknown> {
  id: string;
  label: string;
  items?: T[];
  subcategories?: TreeCategory<T>[];
  count?: number;
}

// Props for rendering an item
export interface TreeItemRenderProps<T> {
  item: T;
  isSelected: boolean;
  onSelect: () => void;
}

// Main component props
export interface TreeExplorerProps<T> {
  /** Title for the explorer header */
  title?: string;
  /** Categories to display */
  categories: TreeCategory<T>[];
  /** Render function for items */
  renderItem: (props: TreeItemRenderProps<T>) => ReactNode;
  /** Currently selected item ID */
  selectedId?: string | null;
  /** Callback when item is selected */
  onSelectItem?: (item: T) => void;
  /** Get ID from item */
  getItemId: (item: T) => string;
  /** Enable search */
  searchable?: boolean;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Filter function for search */
  filterItem?: (item: T, query: string) => boolean;
  /** Header actions (buttons, etc.) */
  headerActions?: ReactNode;
  /** Custom class name */
  className?: string;
  /** Initially expanded categories (defaults to all) */
  initialExpanded?: string[];
}

export function TreeExplorer<T>({
  title,
  categories,
  renderItem,
  selectedId,
  onSelectItem,
  getItemId,
  searchable = false,
  searchPlaceholder = 'Search...',
  filterItem,
  headerActions,
  className = '',
  initialExpanded,
}: TreeExplorerProps<T>) {
  // Collect all category IDs for initial expansion
  const collectIds = (cats: TreeCategory<T>[]): string[] =>
    cats.flatMap((c) => [c.id, ...(c.subcategories ? collectIds(c.subcategories) : [])]);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(initialExpanded ?? collectIds(categories))
  );
  const [searchQuery, setSearchQuery] = useState('');

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Filter categories based on search
  const filterCategories = useCallback(
    (cats: TreeCategory<T>[]): TreeCategory<T>[] => {
      if (!searchQuery || !filterItem) return cats;

      const filterCat = (cat: TreeCategory<T>): TreeCategory<T> | null => {
        const filteredItems = (cat.items || []).filter((item) => filterItem(item, searchQuery));
        const filteredSubs = (cat.subcategories || [])
          .map(filterCat)
          .filter((c): c is TreeCategory<T> => c !== null);

        if (filteredItems.length === 0 && filteredSubs.length === 0) return null;

        return {
          ...cat,
          items: filteredItems,
          subcategories: filteredSubs,
          count: filteredItems.length + filteredSubs.reduce((s, sc) => s + (sc.count || 0), 0),
        };
      };

      return cats.map(filterCat).filter((c): c is TreeCategory<T> => c !== null);
    },
    [searchQuery, filterItem]
  );

  const filteredCategories = filterCategories(categories);

  // Count items in a category (direct + nested)
  const countItems = (cat: TreeCategory<T>): number => {
    if (cat.count !== undefined) return cat.count;
    const direct = (cat.items || []).length;
    const nested = (cat.subcategories || []).reduce((s, sc) => s + countItems(sc), 0);
    return direct + nested;
  };

  // Render a category recursively
  const renderCategory = (cat: TreeCategory<T>, level: number) => {
    const isExpanded = expandedCategories.has(cat.id);
    const count = countItems(cat);

    return (
      <div key={cat.id} className={`tree-explorer__category level-${level}`}>
        <button
          className="tree-explorer__category-header"
          onClick={() => toggleCategory(cat.id)}
          style={{ paddingLeft: 12 + level * 12 }}
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="tree-explorer__category-label">{cat.label}</span>
          <span className="tree-explorer__category-count">{count}</span>
        </button>

        {isExpanded && (
          <div className="tree-explorer__items" style={{ paddingLeft: 8 + level * 12 }}>
            {/* Direct items */}
            {(cat.items || []).map((item) => {
              const itemId = getItemId(item);
              const isSelected = selectedId === itemId;

              return (
                <div
                  key={itemId}
                  className={`tree-explorer__item ${isSelected ? 'tree-explorer__item--selected' : ''}`}
                  onClick={() => onSelectItem?.(item)}
                >
                  {renderItem({
                    item,
                    isSelected,
                    onSelect: () => onSelectItem?.(item),
                  })}
                </div>
              );
            })}

            {/* Nested subcategories */}
            {(cat.subcategories || []).map((sub) => renderCategory(sub, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`tree-explorer ${className}`}>
      {/* Header */}
      {(title || headerActions) && (
        <div className="tree-explorer__header">
          {title && <h2 className="tree-explorer__title">{title}</h2>}
          {headerActions && <div className="tree-explorer__actions">{headerActions}</div>}
        </div>
      )}

      {/* Search */}
      {searchable && (
        <div className="tree-explorer__search">
          <Search size={16} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="tree-explorer__search-input"
          />
        </div>
      )}

      {/* Categories */}
      <div className="tree-explorer__content">
        {filteredCategories.map((cat) => renderCategory(cat, 0))}

        {filteredCategories.length === 0 && (
          <div className="tree-explorer__empty">
            {searchQuery ? 'No results found' : 'No items'}
          </div>
        )}
      </div>
    </div>
  );
}

export default TreeExplorer;
