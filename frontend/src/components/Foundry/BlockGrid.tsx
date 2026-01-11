/**
 * Block Grid
 *
 * Displays blocks in a responsive grid layout.
 * Phase 4f.2 - Foundry Page Foundation
 */

import { useState } from 'react';
import { BlockCard } from './BlockCard';
import type { Block } from '../../types/block.types';
import './BlockGrid.scss';

interface BlockGridProps {
  blocks: Block[];
}

export function BlockGrid({ blocks }: BlockGridProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const handleBlockClick = (blockId: string) => {
    setSelectedBlockId(blockId);
    // TODO: Navigate to block detail view or open in canvas
    console.log('Block clicked:', blockId);
  };

  const handleBlockDoubleClick = (block: Block) => {
    // Navigate into composite blocks (drill-down to canvas)
    if (!block.isAtomic) {
      console.log('Navigate to canvas for block:', block.id);
      // TODO: Implement navigation to canvas
    }
  };

  if (blocks.length === 0) {
    return (
      <div className="block-grid-empty">
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <h3>No blocks found</h3>
          <p>Try adjusting your filters or create a new block to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="block-grid">
      <div className="grid-header">
        <span className="result-count">
          {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
        </span>
      </div>

      <div className="grid-container">
        {blocks.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            isSelected={selectedBlockId === block.id}
            onClick={() => handleBlockClick(block.id)}
            onDoubleClick={() => handleBlockDoubleClick(block)}
          />
        ))}
      </div>
    </div>
  );
}
