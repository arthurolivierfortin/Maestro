/**
 * BlockPalette Component
 *
 * Palette of draggable block types that can be added to the canvas.
 */

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { BlockTypeRegistry } from '../../registry';
import { BlockIcon } from '../icons/BlockIcons';
import type { BlockType } from '../../types/block.types';
import './BlockPalette.scss';

export interface BlockPaletteProps {
  /** Filter by category */
  category?: 'all' | 'agents' | 'tools' | 'flow' | 'data';
  /** Search filter */
  searchQuery?: string;
  /** Callback when drag starts */
  onDragStart?: (blockType: BlockType) => void;
}

interface PaletteCategory {
  id: string;
  label: string;
  /** block types directly under this category */
  blockTypes?: BlockType[];
  /** nested sub-categories */
  subcategories?: PaletteCategory[];
}

// PALETTE_CATEGORIES supports nested categories (subcategories).
// Add subcategories in-code by adding a `subcategories` array to any category.
// Preserve the previous top-level organization: Multi-node and Atomic groups.
// Subcategories can still be added inside these categories if needed.
const PALETTE_CATEGORIES: PaletteCategory[] = [
  // Multi-node containers (can contain other nodes)
  { id: 'multi-node', label: 'Multi-Node', blockTypes: ['workflow', 'agent'] },

  // Atomic blocks grouped under a single top-level category with subcategories
  {
    id: 'atomic',
    label: 'Atomic Blocks',
    blockTypes: [],
    subcategories: [
      { id: 'tasks', label: 'Tasks', blockTypes: ['task'] },
      { id: 'inference', label: 'Inference / LLM', blockTypes: ['inference'] },
      {
        id: 'tools_prompts',
        label: 'Tools & Prompts',
        subcategories: [
          { id: 'tools', label: 'Tools', blockTypes: ['tool'] },
          { id: 'prompts', label: 'Prompts', blockTypes: ['prompt', 'instruction'] },
        ],
      },
      { id: 'flow_control', label: 'Flow Control', blockTypes: ['decision', 'validator', 'trigger'] },
      { id: 'scripts', label: 'Scripts', blockTypes: ['script'] },
    ],
  },
];

export function BlockPalette({ searchQuery = '', onDragStart }: BlockPaletteProps) {
  // initialize expanded set with all known category ids (including nested)
  const collectIds = (cats: PaletteCategory[]): string[] =>
    cats.flatMap((c) => [c.id, ...(c.subcategories ? collectIds(c.subcategories) : [])]);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(collectIds(PALETTE_CATEGORIES)));
  const [search, setSearch] = useState(searchQuery);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Filter categories based on search (keeps nested structure)
  const filteredCategories = useMemo(() => {
    const filterCat = (cat: PaletteCategory): PaletteCategory | null => {
      const directTypes = (cat.blockTypes || []).filter((type) => {
        const typeInfo = BlockTypeRegistry.get(type);
        if (!typeInfo) return false;

        const matchesSearch =
          !search ||
          typeInfo.label.toLowerCase().includes(search.toLowerCase()) ||
          typeInfo.description.toLowerCase().includes(search.toLowerCase());

        return matchesSearch;
      });

      const subcats = (cat.subcategories || [])
        .map(filterCat)
        .filter((c): c is PaletteCategory => c !== null);

      if (directTypes.length === 0 && subcats.length === 0) return null;

      return { ...cat, blockTypes: directTypes, subcategories: subcats };
    };

    return PALETTE_CATEGORIES.map(filterCat).filter((c): c is PaletteCategory => c !== null);
  }, [search]);

  const handleDragStart = (blockType: BlockType) => (e: React.DragEvent) => {
    console.log('[BlockPalette] Drag started:', {
      blockType,
      clientX: e.clientX,
      clientY: e.clientY,
    });

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/reactflow-blocktype', blockType);

    console.log('[BlockPalette] MIME data set to:', blockType);

    if (onDragStart) {
      console.log('[BlockPalette] Calling onDragStart callback');
      onDragStart(blockType);
    }
  };

  // compute counts for a category (direct + nested)
  const countFor = (cat: PaletteCategory): number => {
    const direct = (cat.blockTypes || []).length;
    const nested = (cat.subcategories || []).reduce((s, sc) => s + countFor(sc), 0);
    return direct + nested;
  };

  return (
    <div className="block-palette">
      {/* Search */}
      <div className="block-palette__search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search blocks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block-palette__search-input"
        />
      </div>

      {/* Categories */}
      <div className="block-palette__categories">
        {filteredCategories.map((cat) => (
          <div key={cat.id} className="block-palette__category">
            {renderCategory(cat, 0)}
          </div>
        ))}
      </div>
    </div>
  );

  // recursive renderer for categories and subcategories
  function renderCategory(cat: PaletteCategory, level: number) {
    const isExpanded = expandedCategories.has(cat.id);

    return (
      <div className={`block-palette__category-block level-${level}`} key={cat.id}>
        <button
          className="block-palette__category-header"
          onClick={() => toggleCategory(cat.id)}
          style={{ paddingLeft: 12 + level * 12 }}
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="block-palette__category-label">{cat.label}</span>
          <span className="block-palette__category-count">{countFor(cat)}</span>
        </button>

        {isExpanded && (
          <div className="block-palette__items" style={{ paddingLeft: 8 + level * 12 }}>
            {/* direct block types */}
            {(cat.blockTypes || []).map((type) => {
              const typeInfo = BlockTypeRegistry.get(type);
              if (!typeInfo) return null;

              return (
                <div
                  key={type}
                  className="block-palette__item"
                  draggable
                  onDragStart={handleDragStart(type)}
                  title={typeInfo.description}
                  style={{ marginLeft: level > 0 ? 6 : 0 }}
                >
                  <BlockIcon type={type} size={18} />
                  <span className="block-palette__item-label">{typeInfo.label}</span>
                </div>
              );
            })}

            {/* nested subcategories */}
            {(cat.subcategories || []).map((sc) => (
              <div key={sc.id} className="block-palette__subcategory">
                {renderCategory(sc, level + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}
