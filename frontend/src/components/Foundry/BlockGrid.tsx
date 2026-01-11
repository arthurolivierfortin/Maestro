/**
 * Block Grid Component
 *
 * Displays blocks in a responsive grid layout.
 */

import type { Block } from '../../types/block.types';
import { BlockCard } from './BlockCard';
import './BlockGrid.scss';

interface BlockGridProps {
  blocks: Block[];
}

export function BlockGrid({ blocks }: BlockGridProps) {
  if (blocks.length === 0) {
    return (
      <div className="block-grid__empty">
        <div className="block-grid__empty-icon">📦</div>
        <h3 className="block-grid__empty-title">No blocks found</h3>
        <p className="block-grid__empty-description">
          Try adjusting your filters or create a new block.
        </p>
      </div>
    );
  }

  return (
    <div className="block-grid">
      {blocks.map((block) => (
        <BlockCard key={block.id} block={block} />
      ))}
    </div>
  );
}
