/**
 * BlockCanvas Component
 *
 * Main canvas wrapper for visual block editing using React Flow.
 */

import { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  EdgeTypes,
  BackgroundVariant,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useCanvasSync } from './useCanvasSync';
import { BaseBlockNode } from '../BlockNodes/BaseBlockNode';
import { ConnectionEdge } from '../ConnectionEdge/ConnectionEdge';
import type { Block } from '../../types/block.types';
import './BlockCanvas.scss';

export interface BlockCanvasProps {
  /** Current parent block ID (null for root workflow) */
  parentId: string | null;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when block is selected */
  onBlockSelect?: (blockId: string | null) => void;
  /** Callback when drill-down is requested */
  onDrillDown?: (blockId: string) => void;
  /** Callback when block is dropped on canvas */
  onDrop?: (event: React.DragEvent, position: { x: number; y: number }) => void;
}

/**
 * Node data for React Flow nodes
 */
export interface BlockNodeData {
  block: Block;
  isSelected: boolean;
  isExecuting: boolean;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
  onDrillDown: (blockId: string) => void;
}

/**
 * Edge data for React Flow edges
 */
export interface ConnectionEdgeData {
  sourcePortId: string;
  targetPortId: string;
  dataType: string;
  label?: string;
}

/**
 * Node types mapping for React Flow
 */
const nodeTypes: NodeTypes = {
  agent: BaseBlockNode,
  task: BaseBlockNode,
  tool: BaseBlockNode,
  prompt: BaseBlockNode,
  decision: BaseBlockNode,
  validator: BaseBlockNode,
  trigger: BaseBlockNode,
  workflow: BaseBlockNode,
  instruction: BaseBlockNode,
};

/**
 * Edge types mapping for React Flow
 */
const edgeTypes: EdgeTypes = {
  connection: ConnectionEdge,
};

/**
 * Default edge options
 */
const defaultEdgeOptions = {
  type: 'connection',
  animated: false,
  style: { strokeWidth: 2 },
};

/**
 * BlockCanvas Inner Component (has access to React Flow context)
 */
function BlockCanvasInner({
  parentId,
  readOnly = false,
  onBlockSelect,
  onDrillDown,
  onDrop,
}: BlockCanvasProps) {
  // Sync canvas state with block store
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onPaneClick,
    onDrop: handleDrop,
  } = useCanvasSync({
    parentId,
    onBlockSelect,
    onDrillDown,
    onDrop,
    readOnly,
  });

  // Memoize node types
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);
  const memoizedEdgeTypes = useMemo(() => edgeTypes, []);

  return (
    <div className="block-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDrop={handleDrop}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        nodeTypes={memoizedNodeTypes}
        edgeTypes={memoizedEdgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={readOnly ? null : 'Delete'}
        multiSelectionKeyCode="Shift"
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={!readOnly} />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
          }}
        />
      </ReactFlow>
    </div>
  );
}

/**
 * BlockCanvas Component (wraps with ReactFlowProvider)
 */
export function BlockCanvas(props: BlockCanvasProps) {
  return (
    <ReactFlowProvider>
      <BlockCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
