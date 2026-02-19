/**
 * useBlueprintLayout Hook
 *
 * Transforms workspace blocks into React Flow nodes and edges for blueprint view.
 * Creates a layout with:
 * - Entry points on the left
 * - Arrows from entry points to their target blocks
 * - Workflow containers showing internal child block structure
 * - Uses Dagre for automatic layout
 */

import { useMemo } from 'react';
import dagre from 'dagre';
import type { Node, Edge } from 'reactflow';
import type { Block } from '../../../../types/block.types';
import type { BlueprintBlockNodeData, EntryPoint } from '../../../../types/workspace-canvas.types';

const ENTRY_POINT_WIDTH = 120;
const ENTRY_POINT_HEIGHT = 40;
const BLOCK_NODE_WIDTH = 180;
const BLOCK_NODE_HEIGHT = 70;

interface UseBlueprintLayoutResult {
  nodes: Node<BlueprintBlockNodeData>[];
  edges: Edge[];
}

/**
 * Transform a Block into BlueprintBlockNodeData
 */
function blockToNodeData(
  block: Block,
  entryPoints: EntryPoint[]
): BlueprintBlockNodeData {
  const entryPoint = entryPoints.find(ep => ep.blockId === block.id);
  const childCount = block.children?.length || 0;

  return {
    blockId: block.id,
    name: block.name,
    blockType: block.blockType,
    description: block.metadata?.description,
    isAtomic: block.isAtomic,
    childCount,
    isEntryPoint: !!entryPoint,
    entryPointName: entryPoint?.name,
    entryPointType: entryPoint?.type,
  };
}

/**
 * Hook to compute layout for blueprint canvas
 * Creates entry points on left, blocks in center, with connecting arrows
 */
export function useBlueprintLayout(
  blocks: Block[],
  entryPoints: EntryPoint[] = []
): UseBlueprintLayoutResult {
  return useMemo(() => {
    if (!blocks || blocks.length === 0) {
      return { nodes: [], edges: [] };
    }

    const nodes: Node<BlueprintBlockNodeData>[] = [];
    const edges: Edge[] = [];

    // Map to track block IDs to their entry point
    const blockToEntryPoint = new Map<string, EntryPoint>();
    entryPoints.forEach(ep => {
      blockToEntryPoint.set(ep.blockId, ep);
    });

    // Create a map of all blocks by ID for quick lookup
    const blockMap = new Map<string, Block>();
    const collectAllBlocks = (blockList: Block[]) => {
      for (const block of blockList) {
        blockMap.set(block.id, block);
        if (block.children && block.children.length > 0) {
          collectAllBlocks(block.children);
        }
      }
    };
    collectAllBlocks(blocks);

    // Initialize dagre graph for main block layout
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: 'TB', // Top to bottom
      nodesep: 50,
      ranksep: 70,
      marginx: 40,
      marginy: 40,
    });

    // 1. Create entry point nodes on the left
    const entryPointStartX = 40;
    let entryPointY = 60;

    entryPoints.forEach((ep, index) => {
      nodes.push({
        id: `entry-${ep.blockId}`,
        type: 'blueprintBlock',
        position: { x: entryPointStartX, y: entryPointY + index * (ENTRY_POINT_HEIGHT + 30) },
        data: {
          blockId: ep.blockId,
          name: ep.name,
          blockType: 'trigger', // Visual indicator for entry point
          description: ep.description,
          isAtomic: true,
          childCount: 0,
          isEntryPoint: true,
          entryPointName: ep.name,
          entryPointType: ep.type,
        },
        style: {
          width: ENTRY_POINT_WIDTH,
        },
      });
    });

    // Calculate offset for main content (to the right of entry points)
    const mainContentStartX = entryPoints.length > 0 ? entryPointStartX + ENTRY_POINT_WIDTH + 120 : 40;

    // 2. Add all top-level blocks to dagre (excluding deep children for now)
    blocks.forEach((block) => {
      dagreGraph.setNode(block.id, {
        width: BLOCK_NODE_WIDTH,
        height: BLOCK_NODE_HEIGHT,
      });

      // If this block has children (workflow/agent), also add them
      if (block.children && block.children.length > 0) {
        block.children.forEach((child, index) => {
          dagreGraph.setNode(child.id, {
            width: BLOCK_NODE_WIDTH * 0.8,
            height: BLOCK_NODE_HEIGHT * 0.8,
          });
          // Edge from parent to child
          dagreGraph.setEdge(block.id, child.id);

          // Connect children sequentially (for workflow flow)
          if (index > 0) {
            dagreGraph.setEdge(block.children![index - 1].id, child.id);
          }
        });
      }
    });

    // Connect top-level blocks sequentially if they are workflows
    const workflows = blocks.filter(b => b.blockType === 'workflow');
    for (let i = 0; i < workflows.length - 1; i++) {
      // Don't connect different workflows, let them be separate
    }

    // Run dagre layout
    dagre.layout(dagreGraph);

    // 3. Create block nodes from dagre positions
    const processedBlocks = new Set<string>();

    const addBlockNode = (block: Block, isChild = false) => {
      if (processedBlocks.has(block.id)) return;
      processedBlocks.add(block.id);

      const nodeWithPosition = dagreGraph.node(block.id);
      if (!nodeWithPosition) return;

      nodes.push({
        id: block.id,
        type: 'blueprintBlock',
        position: {
          x: mainContentStartX + nodeWithPosition.x - BLOCK_NODE_WIDTH / 2,
          y: nodeWithPosition.y - BLOCK_NODE_HEIGHT / 2,
        },
        data: blockToNodeData(block, entryPoints),
        style: {
          width: isChild ? BLOCK_NODE_WIDTH * 0.8 : BLOCK_NODE_WIDTH,
        },
      });

      // Process children
      if (block.children && block.children.length > 0) {
        block.children.forEach(child => {
          addBlockNode(child, true);

          // Create edge from parent to child
          edges.push({
            id: `${block.id}-${child.id}`,
            source: block.id,
            target: child.id,
            type: 'blueprint',
            data: { isChildRelation: true },
            animated: false,
          });
        });

        // Create edges between sequential children (workflow flow)
        for (let i = 0; i < block.children.length - 1; i++) {
          edges.push({
            id: `flow-${block.children[i].id}-${block.children[i + 1].id}`,
            source: block.children[i].id,
            target: block.children[i + 1].id,
            type: 'blueprint',
            data: { isFlowRelation: true },
            style: { strokeDasharray: '5,5' },
            animated: false,
          });
        }
      }
    };

    blocks.forEach(block => addBlockNode(block));

    // 4. Create edges from entry points to their target blocks
    entryPoints.forEach(ep => {
      if (blockMap.has(ep.blockId)) {
        edges.push({
          id: `entry-edge-${ep.blockId}`,
          source: `entry-${ep.blockId}`,
          sourceHandle: 'right',
          target: ep.blockId,
          targetHandle: 'left',
          type: 'blueprint',
          data: { isEntryPointLink: true },
          animated: true,
          style: {
            stroke: '#f59e0b',
            strokeWidth: 2,
          },
        });
      }
    });

    return { nodes, edges };
  }, [blocks, entryPoints]);
}

export default useBlueprintLayout;
