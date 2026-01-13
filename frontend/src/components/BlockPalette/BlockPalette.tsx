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
  blockTypes: BlockType[];
}

const PALETTE_CATEGORIES: PaletteCategory[] = [
  { id: 'agents', label: 'Agents & Tasks', blockTypes: ['agent', 'task'] },
  { id: 'tools', label: 'Tools & Prompts', blockTypes: ['tool', 'prompt', 'instruction'] },
  { id: 'flow', label: 'Flow Control', blockTypes: ['decision', 'validator', 'trigger'] },
  { id: 'containers', label: 'Containers', blockTypes: ['workflow'] },
];

export function BlockPalette({ searchQuery = '', onDragStart }: BlockPaletteProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(PALETTE_CATEGORIES.map((c) => c.id))
  );
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

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    return PALETTE_CATEGORIES.map((cat) => {
      const filteredTypes = cat.blockTypes.filter((type) => {
        const typeInfo = BlockTypeRegistry.get(type);
        if (!typeInfo) return false;

        const matchesSearch =
          !search ||
          typeInfo.label.toLowerCase().includes(search.toLowerCase()) ||
          typeInfo.description.toLowerCase().includes(search.toLowerCase());

        return matchesSearch;
      });

      return { ...cat, blockTypes: filteredTypes };
    }).filter((cat) => cat.blockTypes.length > 0);
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
            <button
              className="block-palette__category-header"
              onClick={() => toggleCategory(cat.id)}
            >
              {expandedCategories.has(cat.id) ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              <span className="block-palette__category-label">{cat.label}</span>
              <span className="block-palette__category-count">{cat.blockTypes.length}</span>
            </button>

            {expandedCategories.has(cat.id) && (
              <div className="block-palette__items">
                {cat.blockTypes.map((type) => {
                  const typeInfo = BlockTypeRegistry.get(type);
                  if (!typeInfo) return null;

                  return (
                    <div
                      key={type}
                      className="block-palette__item"
                      draggable
                      onDragStart={handleDragStart(type)}
                      title={typeInfo.description}
                    >
                      <BlockIcon type={type} size={18} />
                      <span className="block-palette__item-label">{typeInfo.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
