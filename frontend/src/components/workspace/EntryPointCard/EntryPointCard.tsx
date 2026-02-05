/**
 * EntryPointCard Component
 *
 * Displays an entry point with a mini flow diagram, type badge,
 * block count summary, and action buttons.
 */

import React, { useMemo } from 'react';
import { Play, Eye } from 'lucide-react';
import { BlockIcon, blockColorMap } from '../../icons';
import { MiniFlowDiagram } from './MiniFlowDiagram';
import { Button } from '../../common/Button';
import type { Block, BlockType } from '../../../types/block.types';
import type { EntryPoint, EntryPointType } from '../../../types/workspace-canvas.types';
import './EntryPointCard.scss';

const entryPointTypeLabels: Record<EntryPointType, string> = {
  main: 'Main Entry',
  dashboard: 'Dashboard',
  experiments: 'Experiments',
  settings: 'Settings',
  custom: 'Custom',
};

const entryPointTypeColors: Record<EntryPointType, string> = {
  main: '#f59e0b',
  dashboard: '#3b82f6',
  experiments: '#8b5cf6',
  settings: '#6b7280',
  custom: '#10b981',
};

interface EntryPointCardProps {
  entryPoint: EntryPoint;
  block: Block | null;
  workspaceId: string;
  onStart?: () => void;
  onPreview?: () => void;
}

export const EntryPointCard: React.FC<EntryPointCardProps> = ({
  entryPoint,
  block,
  onStart,
  onPreview,
}) => {
  const typeColor = entryPointTypeColors[entryPoint.type] || '#6b7280';
  const typeLabel = entryPointTypeLabels[entryPoint.type] || 'Entry Point';

  // Collect blocks for mini diagram
  const diagramBlocks = useMemo(() => {
    if (!block) return [];
    const result: Block[] = [block];

    // Add immediate children (max 5 for mini diagram)
    if (block.children) {
      result.push(...block.children.slice(0, 5));
    }

    return result;
  }, [block]);

  // Count total blocks (recursively)
  const blockCount = useMemo(() => {
    if (!block) return 0;

    const countBlocks = (b: Block): number => {
      let count = 1;
      if (b.children) {
        for (const child of b.children) {
          count += countBlocks(child);
        }
      }
      return count;
    };

    return countBlocks(block);
  }, [block]);

  // Get block type breakdown
  const typeBreakdown = useMemo(() => {
    if (!block) return {};

    const counts: Record<string, number> = {};

    const countTypes = (b: Block) => {
      counts[b.blockType] = (counts[b.blockType] || 0) + 1;
      if (b.children) {
        for (const child of b.children) {
          countTypes(child);
        }
      }
    };

    countTypes(block);
    return counts;
  }, [block]);

  return (
    <div className="entry-point-card">
      {/* Header */}
      <div className="entry-point-card__header">
        <div className="entry-point-card__icon">
          {block ? (
            <BlockIcon type={block.blockType as BlockType} size={24} />
          ) : (
            <div className="entry-point-card__placeholder-icon" />
          )}
        </div>
        <div className="entry-point-card__title-group">
          <h4 className="entry-point-card__name">{entryPoint.name}</h4>
          <span
            className="entry-point-card__type-badge"
            style={{ backgroundColor: typeColor }}
          >
            {typeLabel}
          </span>
        </div>
      </div>

      {/* Mini Flow Diagram */}
      <div className="entry-point-card__diagram">
        <MiniFlowDiagram blocks={diagramBlocks} />
      </div>

      {/* Stats */}
      <div className="entry-point-card__stats">
        <div className="entry-point-card__stat">
          <span className="entry-point-card__stat-value">{blockCount}</span>
          <span className="entry-point-card__stat-label">
            {blockCount === 1 ? 'block' : 'blocks'}
          </span>
        </div>
        {Object.entries(typeBreakdown).slice(0, 3).map(([type, count]) => (
          <div key={type} className="entry-point-card__type-count">
            <span
              className="entry-point-card__type-dot"
              style={{ backgroundColor: blockColorMap[type as BlockType] || '#6b7280' }}
            />
            <span>{count} {type}</span>
          </div>
        ))}
      </div>

      {/* Description */}
      {entryPoint.description && (
        <p className="entry-point-card__description">{entryPoint.description}</p>
      )}

      {/* Actions */}
      <div className="entry-point-card__actions">
        <Button
          variant="primary"
          size="sm"
          icon={<Play size={14} />}
          onClick={onStart}
        >
          Start
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Eye size={14} />}
          onClick={onPreview}
        >
          Preview
        </Button>
      </div>
    </div>
  );
};

export default EntryPointCard;
