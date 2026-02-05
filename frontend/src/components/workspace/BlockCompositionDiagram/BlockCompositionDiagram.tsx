/**
 * BlockCompositionDiagram Component
 *
 * Displays block composition in three columns: Workflows | Agents | Tools
 * with conceptual connecting lines showing the orchestration pattern.
 *
 * Spec: "Workflows orchestrate agents, which use tools to perform actions"
 */

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Workflow, Bot, Wrench, ChevronRight } from 'lucide-react';
import { BlockIcon, blockColorMap } from '../../icons';
import type { Block, BlockType } from '../../../types/block.types';
import './BlockCompositionDiagram.scss';

interface BlockCompositionDiagramProps {
  blocks: Block[];
  onBlockClick?: (blockId: string) => void;
  onViewAll?: () => void;
}

interface ColumnItem {
  id: string;
  name: string;
  blockType: BlockType;
}

const MAX_ITEMS_PER_COLUMN = 5;

export const BlockCompositionDiagram: React.FC<BlockCompositionDiagramProps> = ({
  blocks,
  onBlockClick,
  onViewAll,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [connectionPaths, setConnectionPaths] = useState<string[]>([]);

  // Categorize blocks into columns
  const { workflows, agents, tools } = useMemo(() => {
    const workflowList: ColumnItem[] = [];
    const agentList: ColumnItem[] = [];
    const toolList: ColumnItem[] = [];

    // Helper to collect all blocks recursively
    const collectBlocks = (block: Block) => {
      const item: ColumnItem = {
        id: block.id,
        name: block.name,
        blockType: block.blockType as BlockType,
      };

      switch (block.blockType) {
        case 'workflow':
          workflowList.push(item);
          break;
        case 'agent':
          agentList.push(item);
          break;
        case 'tool':
          toolList.push(item);
          break;
      }

      // Recurse into children
      block.children?.forEach(child => collectBlocks(child));
    };

    blocks.forEach(block => collectBlocks(block));

    return {
      workflows: workflowList,
      agents: agentList,
      tools: toolList,
    };
  }, [blocks]);

  // Calculate SVG connection paths between columns
  useEffect(() => {
    if (!containerRef.current) return;

    const calculateConnections = () => {
      const container = containerRef.current;
      if (!container) return;

      const paths: string[] = [];
      const containerRect = container.getBoundingClientRect();

      // Get column elements
      const columns = container.querySelectorAll('.block-composition__column');
      if (columns.length < 3) return;

      const workflowCol = columns[0];
      const agentCol = columns[1];
      const toolCol = columns[2];

      // Calculate connection points between workflow column and agent column
      const workflowItems = workflowCol.querySelectorAll('.block-composition__item');
      const agentItems = agentCol.querySelectorAll('.block-composition__item');
      const toolItems = toolCol.querySelectorAll('.block-composition__item');

      // Draw conceptual arrows from workflows to agents
      if (workflowItems.length > 0 && agentItems.length > 0) {
        const agentColRect = agentCol.getBoundingClientRect();

        // Draw arrows from each workflow item to the agent column center
        workflowItems.forEach((item) => {
          const itemRect = item.getBoundingClientRect();
          const startX = itemRect.right - containerRect.left;
          const startY = itemRect.top + itemRect.height / 2 - containerRect.top;
          const endX = agentColRect.left - containerRect.left;
          const endY = agentColRect.top + agentColRect.height / 2 - containerRect.top;

          // Bezier curve
          const midX = (startX + endX) / 2;
          paths.push(`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`);
        });
      }

      // Draw conceptual arrows from agents to tools
      if (agentItems.length > 0 && toolItems.length > 0) {
        const toolColRect = toolCol.getBoundingClientRect();

        agentItems.forEach((item) => {
          const itemRect = item.getBoundingClientRect();
          const startX = itemRect.right - containerRect.left;
          const startY = itemRect.top + itemRect.height / 2 - containerRect.top;
          const endX = toolColRect.left - containerRect.left;
          const endY = toolColRect.top + toolColRect.height / 2 - containerRect.top;

          const midX = (startX + endX) / 2;
          paths.push(`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`);
        });
      }

      setConnectionPaths(paths);
    };

    // Calculate on mount and resize
    const timeoutId = setTimeout(calculateConnections, 100);
    window.addEventListener('resize', calculateConnections);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', calculateConnections);
    };
  }, [workflows, agents, tools]);

  const renderColumn = (
    title: string,
    icon: React.ReactNode,
    items: ColumnItem[],
    color: string
  ) => {
    const displayItems = items.slice(0, MAX_ITEMS_PER_COLUMN);
    const remaining = items.length - MAX_ITEMS_PER_COLUMN;

    return (
      <div className="block-composition__column">
        <div className="block-composition__column-header">
          <span className="block-composition__column-icon" style={{ color }}>
            {icon}
          </span>
          <span className="block-composition__column-title">{title}</span>
          <span className="block-composition__column-count">({items.length})</span>
        </div>
        <div className="block-composition__column-items">
          {displayItems.map(item => (
            <button
              key={item.id}
              className="block-composition__item"
              data-block-id={item.id}
              onClick={() => onBlockClick?.(item.id)}
            >
              <BlockIcon type={item.blockType} size={14} />
              <span className="block-composition__item-name">{item.name}</span>
            </button>
          ))}
          {remaining > 0 && (
            <div className="block-composition__more">
              +{remaining} more
            </div>
          )}
          {items.length === 0 && (
            <div className="block-composition__empty">None</div>
          )}
        </div>
      </div>
    );
  };

  const hasContent = workflows.length > 0 || agents.length > 0 || tools.length > 0;

  if (!hasContent) {
    return (
      <div className="block-composition block-composition--empty">
        <p>No blocks available</p>
      </div>
    );
  }

  return (
    <div className="block-composition" ref={containerRef}>
      <div className="block-composition__header">
        <h3 className="block-composition__title">Block Composition</h3>
        {onViewAll && (
          <button className="block-composition__view-all" onClick={onViewAll}>
            View All <ChevronRight size={14} />
          </button>
        )}
      </div>

      <div className="block-composition__diagram">
        {/* SVG for connection lines */}
        <svg className="block-composition__connections">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 6 3, 0 6" fill="rgba(148, 163, 184, 0.4)" />
            </marker>
          </defs>
          {connectionPaths.map((path, index) => (
            <path
              key={index}
              d={path}
              className="block-composition__connection-line"
              markerEnd="url(#arrowhead)"
            />
          ))}
        </svg>

        {/* Columns */}
        <div className="block-composition__columns">
          {renderColumn('Workflows', <Workflow size={16} />, workflows, blockColorMap.workflow)}
          {renderColumn('Agents', <Bot size={16} />, agents, blockColorMap.agent)}
          {renderColumn('Tools', <Wrench size={16} />, tools, blockColorMap.tool)}
        </div>
      </div>

      {/* Explanation text */}
      <p className="block-composition__explanation">
        Workflows orchestrate agents, which use tools to perform actions
      </p>
    </div>
  );
};

export default BlockCompositionDiagram;
