/**
 * MiniFlowDiagram Component
 *
 * Compact flow diagram showing abbreviated block types with flow arrows.
 * Matches the spec: R→T→T→D→P pattern with visual flow.
 */

import React, { useMemo } from 'react';
import { blockColorMap } from '../../icons';
import type { Block, BlockType } from '../../../types/block.types';
import './MiniFlowDiagram.scss';

const MAX_VISIBLE_BLOCKS = 6;

// Block type abbreviations for compact display
const blockTypeAbbreviations: Record<string, string> = {
  workflow: 'W',
  agent: 'A',
  tool: 'T',
  task: 'K',
  prompt: 'P',
  instruction: 'I',
  decision: 'D',
  validator: 'V',
  trigger: 'G',
  inference: 'N',
  script: 'S',
};

// Get first letter of block name as abbreviation
function getBlockAbbreviation(block: Block): string {
  // Use first letter of name, or type abbreviation if name is generic
  const firstLetter = block.name.charAt(0).toUpperCase();
  if (firstLetter && /[A-Z]/.test(firstLetter)) {
    return firstLetter;
  }
  return blockTypeAbbreviations[block.blockType] || 'B';
}

interface MiniFlowDiagramProps {
  blocks: Block[];
  maxBlocks?: number;
}

export const MiniFlowDiagram: React.FC<MiniFlowDiagramProps> = ({
  blocks,
  maxBlocks = MAX_VISIBLE_BLOCKS,
}) => {
  // Get the child blocks to display (excluding the root workflow itself)
  const flowBlocks = useMemo(() => {
    if (blocks.length === 0) return [];

    // If first block has children, show the children as the flow
    const root = blocks[0];
    if (root.children && root.children.length > 0) {
      return root.children;
    }

    // Otherwise show the blocks as-is (excluding root if it's a workflow)
    if (root.blockType === 'workflow' && blocks.length > 1) {
      return blocks.slice(1);
    }

    return blocks;
  }, [blocks]);

  const visibleBlocks = flowBlocks.slice(0, maxBlocks);
  const remaining = flowBlocks.length - maxBlocks;

  if (flowBlocks.length === 0) {
    return (
      <div className="mini-flow-diagram mini-flow-diagram--empty">
        <span>No blocks</span>
      </div>
    );
  }

  // Split into rows for display (max 3 per row)
  const rows: Block[][] = [];
  const blocksPerRow = 3;

  for (let i = 0; i < visibleBlocks.length; i += blocksPerRow) {
    rows.push(visibleBlocks.slice(i, i + blocksPerRow));
  }

  return (
    <div className="mini-flow-diagram">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="mini-flow-diagram__row">
          {row.map((block, blockIndex) => {
            const color = blockColorMap[block.blockType as BlockType] || '#6b7280';
            const isLast = rowIndex === rows.length - 1 && blockIndex === row.length - 1;
            const showArrow = !isLast || remaining > 0;
            // Alternate row direction for flow visualization
            const isReversed = rowIndex % 2 === 1;

            return (
              <React.Fragment key={block.id}>
                <div
                  className="mini-flow-diagram__block"
                  style={{ borderColor: color }}
                  title={`${block.name} (${block.blockType})`}
                >
                  <span className="mini-flow-diagram__letter" style={{ color }}>
                    {getBlockAbbreviation(block)}
                  </span>
                </div>
                {showArrow && blockIndex < row.length - 1 && (
                  <span className="mini-flow-diagram__arrow">
                    {isReversed ? '←' : '→'}
                  </span>
                )}
              </React.Fragment>
            );
          })}
          {/* Arrow to next row */}
          {rowIndex < rows.length - 1 && (
            <span className="mini-flow-diagram__row-connector">
              {rowIndex % 2 === 0 ? '↓' : '↓'}
            </span>
          )}
        </div>
      ))}
      {remaining > 0 && (
        <div className="mini-flow-diagram__more">
          +{remaining} more
        </div>
      )}
    </div>
  );
};

export default MiniFlowDiagram;
