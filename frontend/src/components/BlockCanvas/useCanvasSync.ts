/**
 * useCanvasSync Hook
 *
 * Synchronizes React Flow state with BlockStore and NavigationStore.
 */

import { useCallback, useMemo } from 'react';
import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeMouseHandler,
} from 'reactflow';
import { useBlockStore } from '../../store/blockStore';
import { useNavigationStore } from '../../store/navigationStore';
import { useExecutionStore } from '../../store/executionStore';
import type { Block, BlockConnection } from '../../types/block.types';
import type { BlockNodeData, ConnectionEdgeData } from './BlockCanvas';

interface UseCanvasSyncProps {
  parentId: string | null;
  onBlockSelect?: (blockId: string | null) => void;
  onDrillDown?: (blockId: string) => void;
  readOnly?: boolean;
}

/**
 * Convert blocks to React Flow nodes
 */
function blocksToNodes(
  blocks: Block[],
  selectedBlockId: string | null,
  onDrillDown: (blockId: string) => void,
  nodeExecutions?: Map<string, { status: string; isExecuting: boolean }>
): Node<BlockNodeData>[] {
  return blocks.map((block) => {
    const execution = nodeExecutions?.get(block.id);
    return {
      id: block.id,
      type: block.blockType,
      position: block.position,
      data: {
        block,
        isSelected: block.id === selectedBlockId,
        isExecuting: execution?.isExecuting || false,
        executionStatus: execution?.status as any,
        onDrillDown,
      },
    };
  });
}

/**
 * Convert connections to React Flow edges
 */
function connectionsToEdges(connections: BlockConnection[]): Edge<ConnectionEdgeData>[] {
  return connections.map((conn) => ({
    id: conn.id,
    source: conn.sourceBlockId,
    target: conn.targetBlockId,
    sourceHandle: conn.sourcePortId,
    targetHandle: conn.targetPortId,
    type: 'connection',
    data: {
      sourcePortId: conn.sourcePortId,
      targetPortId: conn.targetPortId,
      dataType: 'any', // TODO: Get from port definition
      label: conn.label,
    },
  }));
}

/**
 * Generate unique connection ID
 */
function generateConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useCanvasSync({
  parentId,
  onBlockSelect,
  onDrillDown,
  readOnly = false,
}: UseCanvasSyncProps) {
  // Store hooks
  const { getBlockChildren, updateBlock, addConnection, removeConnection, getBlockConnections } =
    useBlockStore();
  const { selectedBlockId, selectBlock } = useNavigationStore();
  const { currentExecution } = useExecutionStore();
  const getRootBlock = useBlockStore((state) => state.getRootBlock);

  // Get current block and its children - memoized to avoid exhaustive deps warnings
  const childBlocks = useMemo(() => {
    return parentId ? getBlockChildren(parentId) : [];
  }, [parentId, getBlockChildren]);

  const connections = useMemo(() => {
    return parentId ? getBlockConnections(parentId) : [];
  }, [parentId, getBlockConnections]);

  // If viewing root (parentId === null), get all top-level blocks
  const blocksToDisplay = useMemo(() => {
    const rootBlock = getRootBlock();
    return parentId === null && rootBlock ? [rootBlock] : childBlocks;
  }, [parentId, getRootBlock, childBlocks]);

  // Create execution state map for nodes
  const nodeExecutions = useMemo(() => {
    if (!currentExecution) return undefined;
    
    const map = new Map();
    currentExecution.nodeExecutions?.forEach((nodeExec) => {
      map.set(nodeExec.nodeId, {
        status: nodeExec.status.toLowerCase(),
        isExecuting: nodeExec.status === 'Running',
      });
    });
    return map;
  }, [currentExecution]);

  // Drill-down handler
  const handleDrillDown = useCallback(
    (blockId: string) => {
      if (onDrillDown) {
        onDrillDown(blockId);
      }
    },
    [onDrillDown]
  );

  // Convert to React Flow format
  const nodes = useMemo(
    () => blocksToNodes(blocksToDisplay, selectedBlockId, handleDrillDown, nodeExecutions),
    [blocksToDisplay, selectedBlockId, handleDrillDown, nodeExecutions]
  );

  const edges = useMemo(() => connectionsToEdges(connections), [connections]);

  // Handle node changes (position, selection, deletion)
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (readOnly) return;

      changes.forEach((change) => {
        switch (change.type) {
          case 'position':
            if (change.position && change.dragging === false) {
              // Only update position when drag is complete
              updateBlock(change.id, { position: change.position });
            }
            break;

          case 'remove':
            // Handled by keyboard shortcuts
            break;

          default:
            break;
        }
      });
    },
    [updateBlock, readOnly]
  );

  // Handle edge changes (deletion)
  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (readOnly) return;

      changes.forEach((change) => {
        if (change.type === 'remove' && parentId) {
          removeConnection(parentId, change.id);
        }
      });
    },
    [removeConnection, parentId, readOnly]
  );

  // Handle new connections
  const handleConnect: OnConnect = useCallback(
    (connection) => {
      if (readOnly || !parentId || !connection.source || !connection.target) return;

      const newConnection: BlockConnection = {
        id: generateConnectionId(),
        sourceBlockId: connection.source,
        sourcePortId: connection.sourceHandle || 'output',
        targetBlockId: connection.target,
        targetPortId: connection.targetHandle || 'input',
      };

      addConnection(parentId, newConnection);
    },
    [addConnection, parentId, readOnly]
  );

  // Handle node click (selection)
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      selectBlock(node.id);
      if (onBlockSelect) {
        onBlockSelect(node.id);
      }
    },
    [selectBlock, onBlockSelect]
  );

  // Handle pane click (deselect)
  const handlePaneClick = useCallback(() => {
    selectBlock(null);
    if (onBlockSelect) {
      onBlockSelect(null);
    }
  }, [selectBlock, onBlockSelect]);

  return {
    nodes,
    edges,
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect: handleConnect,
    onNodeClick: handleNodeClick,
    onPaneClick: handlePaneClick,
  };
}
