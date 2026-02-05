/**
 * WorkflowFlowDiagram Component
 *
 * Full execution flow diagram for a workflow.
 * Shows blocks with numbered steps and better spacing.
 */

import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  type Node,
  type Edge,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { BlockIcon, blockColorMap } from '../../icons';
import type { Block, BlockType } from '../../../types/block.types';
import './WorkflowFlowDiagram.scss';

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;

interface FlowNodeData {
  name: string;
  blockType: string;
  stepNumber: number;
}

// Flow node component
const FlowNode: React.FC<{ data: FlowNodeData }> = ({ data }) => {
  const color = blockColorMap[data.blockType as BlockType] || '#6b7280';

  return (
    <div className="workflow-flow-node" style={{ borderColor: color }}>
      <span className="workflow-flow-node__step">{data.stepNumber}</span>
      <div className="workflow-flow-node__content">
        <BlockIcon type={data.blockType as BlockType} size={14} />
        <span className="workflow-flow-node__name" title={data.name}>
          {data.name}
        </span>
      </div>
      <span
        className="workflow-flow-node__type"
        style={{ backgroundColor: color }}
      >
        {data.blockType}
      </span>
    </div>
  );
};

const nodeTypes = {
  flowBlock: FlowNode,
};

interface WorkflowFlowDiagramProps {
  workflow: Block;
}

export const WorkflowFlowDiagram: React.FC<WorkflowFlowDiagramProps> = ({
  workflow,
}) => {
  const { nodes, edges } = useMemo(() => {
    const nodeList: Node<FlowNodeData>[] = [];
    const edgeList: Edge[] = [];

    if (!workflow.children || workflow.children.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Initialize dagre graph
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: 'LR', // Left to right
      nodesep: 40,
      ranksep: 80,
      marginx: 20,
      marginy: 20,
    });

    // Flatten children to get direct flow
    let stepNumber = 1;

    const processBlock = (block: Block, parentId?: string) => {
      // Add node
      nodeList.push({
        id: block.id,
        type: 'flowBlock',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          name: block.name,
          blockType: block.blockType,
          stepNumber: stepNumber++,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });

      dagreGraph.setNode(block.id, {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });

      // Add edge from parent
      if (parentId) {
        edgeList.push({
          id: `${parentId}-${block.id}`,
          source: parentId,
          target: block.id,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#4a5568', strokeWidth: 2 },
        });

        dagreGraph.setEdge(parentId, block.id);
      }

      // Process children (limited depth for display)
      if (block.children && block.children.length > 0 && stepNumber <= 10) {
        block.children.forEach(child => {
          processBlock(child, block.id);
        });
      }
    };

    // Process all top-level children
    let prevId: string | undefined;
    workflow.children.slice(0, 10).forEach((child) => {
      processBlock(child, prevId);
      prevId = child.id;
    });

    // Run dagre layout
    dagre.layout(dagreGraph);

    // Apply positions
    nodeList.forEach(node => {
      const nodeWithPosition = dagreGraph.node(node.id);
      if (nodeWithPosition) {
        node.position = {
          x: nodeWithPosition.x - NODE_WIDTH / 2,
          y: nodeWithPosition.y - NODE_HEIGHT / 2,
        };
      }
    });

    return { nodes: nodeList, edges: edgeList };
  }, [workflow]);

  if (nodes.length === 0) {
    return (
      <div className="workflow-flow-diagram workflow-flow-diagram--empty">
        <span>No blocks in workflow</span>
      </div>
    );
  }

  return (
    <div className="workflow-flow-diagram">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={12}
          size={1}
          color="rgba(255, 255, 255, 0.05)"
        />
        <Controls
          showZoom
          showFitView
          showInteractive={false}
          className="workflow-flow-diagram__controls"
        />
      </ReactFlow>
    </div>
  );
};

export default WorkflowFlowDiagram;
