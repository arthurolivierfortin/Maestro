/**
 * useCanvasSync Hook
 *
 * Synchronizes React Flow state with BlockStore and NavigationStore.
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeMouseHandler,
} from 'reactflow';
import { useReactFlow, applyNodeChanges } from 'reactflow';
import { useBlockStore } from '../../store/blockStore';
import { useNavigationStore } from '../../store/navigationStore';
import { useExecutionStore } from '../../store/executionStore';
import type { Block, BlockConnection } from '../../types/block.types';
import type { BlockNodeData, ConnectionEdgeData } from './BlockCanvas';

interface UseCanvasSyncProps {
  parentId: string | null;
  onBlockSelect?: (blockId: string | null) => void;
  onDrillDown?: (blockId: string) => void;
  onDrop?: (event: React.DragEvent, position: { x: number; y: number }) => void;
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
  return blocks.map((block, index) => {
    const execution = nodeExecutions?.get(block.id);
    
    // Provide default position if not set
    const position = block.position || { 
      x: index * 280, 
      y: 0 
    };
    
    return {
      id: block.id,
      type: block.blockType,
      position,
      data: {
        block,
        isSelected: block.id === selectedBlockId,
        isExecuting: execution?.isExecuting || false,
        executionStatus: execution?.status as any,
        onDrillDown,
        hasChildren: (block.children && block.children.length > 0) || false,
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
  onDrop,
  readOnly = false,
}: UseCanvasSyncProps) {
  // Store hooks - use reactive selectors for automatic re-renders
  const blocks = useBlockStore((state) => state.blocks);
  const rootId = useBlockStore((state) => state.rootId);
  const updateBlock = useBlockStore((state) => state.updateBlock);
  const addConnection = useBlockStore((state) => state.addConnection);
  const removeConnection = useBlockStore((state) => state.removeConnection);
  
  const { selectedBlockId, selectBlock } = useNavigationStore();
  const { currentExecution } = useExecutionStore();
  
  // React Flow hook for coordinate transformation (correct API: screenToFlowPosition)
  const { screenToFlowPosition } = useReactFlow();

  // Determine the "context" block - the block whose children we're viewing
  // If parentId is null, we're viewing the root block's children
  // If parentId is set, we're viewing that block's children
  const contextBlockId = parentId ?? rootId;

  // Derive blocks to display reactively from the blocks Map
  // IMPORTANT: We use the Map as the source of truth, NOT contextBlock.children
  // This ensures positions are always current (children array may have stale copies)
  const blocksToDisplay = useMemo(() => {
    if (!contextBlockId) return [];
    
    // Get all blocks whose parentId matches the context block
    // This ensures we always get the current block data from the Map
    const childBlocks: Block[] = [];
    blocks.forEach((block) => {
      if (block.parentId === contextBlockId) {
        childBlocks.push(block);
      }
    });
    
    console.log('[useCanvasSync] blocksToDisplay:', childBlocks.map(b => ({ 
      id: b.id, 
      name: b.name,
      position: b.position 
    })));
    
    return childBlocks;
  }, [contextBlockId, blocks]);

  // Derive connections reactively (connections belong to the context block)
  const connections = useMemo(() => {
    if (!contextBlockId) return [];
    const contextBlock = blocks.get(contextBlockId);
    return contextBlock?.connections || [];
  }, [contextBlockId, blocks]);

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

  // Convert store blocks to React Flow format (source of truth from store)
  const storeNodes = useMemo(
    () => {
      const nodes = blocksToNodes(blocksToDisplay, selectedBlockId, handleDrillDown, nodeExecutions);
      console.log('[useCanvasSync] storeNodes recalculated:', nodes.map(n => ({ id: n.id, position: n.position })));
      return nodes;
    },
    [blocksToDisplay, selectedBlockId, handleDrillDown, nodeExecutions]
  );

  // Local state for nodes - allows React Flow to control positions during drag
  const [localNodes, setLocalNodes] = useState<Node<BlockNodeData>[]>(storeNodes);

  // Sync local nodes when store changes (but not during drag)
  // IMPORTANT: Only sync if block data actually changed, not just references
  useEffect(() => {
    // Compare by block positions to avoid unnecessary syncs
    const storePositions = storeNodes.map(n => `${n.id}:${n.position.x},${n.position.y}`).sort().join('|');
    const localPositions = localNodes.map(n => `${n.id}:${n.position.x},${n.position.y}`).sort().join('|');
    
    // Also check if node count changed (add/remove)
    const storeIds = storeNodes.map(n => n.id).sort().join('|');
    const localIds = localNodes.map(n => n.id).sort().join('|');
    
    console.log('[useCanvasSync] Sync check:', {
      storePositions,
      localPositions,
      positionsMatch: storePositions === localPositions,
      idsMatch: storeIds === localIds,
    });
    
    // Only sync if nodes were added/removed OR if store has different positions
    // (store positions take precedence when they change from external source)
    if (storeIds !== localIds) {
      console.log('[useCanvasSync] Node list changed - syncing');
      setLocalNodes(storeNodes);
    } else if (storePositions !== localPositions) {
      // Store positions changed - but we need to check if this is from a drag we just did
      // or from external source. For now, preserve local positions during edits
      // Only sync if a significant data change happened (not just position)
      const storeDataHash = storeNodes.map(n => `${n.id}:${n.data.isSelected}:${n.data.isExecuting}`).join('|');
      const localDataHash = localNodes.map(n => `${n.id}:${n.data.isSelected}:${n.data.isExecuting}`).join('|');
      
      if (storeDataHash !== localDataHash) {
        console.log('[useCanvasSync] Data changed - syncing while preserving positions');
        // Merge: use local positions but update other data from store
        setLocalNodes(prev => {
          const positionMap = new Map(prev.map(n => [n.id, n.position]));
          return storeNodes.map(n => ({
            ...n,
            position: positionMap.get(n.id) || n.position,
          }));
        });
      } else {
        console.log('[useCanvasSync] Only positions differ - keeping local positions');
      }
    }
  }, [storeNodes]);

  const edges = useMemo(() => connectionsToEdges(connections), [connections]);

  // Handle node changes (position, selection, deletion)
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Apply changes to local state immediately for smooth dragging
      setLocalNodes((nds) => applyNodeChanges(changes, nds));
      
      if (readOnly) {
        return;
      }

      changes.forEach((change) => {
        switch (change.type) {
          case 'position':
            // Only persist to store when dragging is finished
            if (change.position && !change.dragging) {
              console.log('[useCanvasSync] Saving final position to store:', change.id, change.position);
              updateBlock(change.id, { position: change.position });
            }
            // During drag: positions are already applied to localNodes via applyNodeChanges
            break;

          case 'remove':
            // Handled by keyboard shortcuts
            break;
          
          case 'dimensions':
          case 'select':
            // Ignore - handled elsewhere
            break;
        }
      });
    },
    [updateBlock, readOnly]
  );

  // Handle edge changes (deletion)
  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      console.log('[useCanvasSync] handleEdgesChange called:', changes);
      
      if (readOnly) {
        console.log('[useCanvasSync] Ignored - readOnly mode');
        return;
      }

      changes.forEach((change) => {
        if (change.type === 'remove' && contextBlockId) {
          console.log('[useCanvasSync] Removing connection:', change.id);
          removeConnection(contextBlockId, change.id);
        }
      });
    },
    [removeConnection, contextBlockId, readOnly]
  );

  // Handle new connections
  const handleConnect: OnConnect = useCallback(
    (connection) => {
      console.log('[useCanvasSync] handleConnect called:', {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        readOnly,
        contextBlockId,
      });
      
      if (readOnly || !contextBlockId || !connection.source || !connection.target) {
        console.warn('[useCanvasSync] Connection ignored - check conditions above');
        return;
      }

      const newConnection: BlockConnection = {
        id: generateConnectionId(),
        sourceBlockId: connection.source,
        sourcePortId: connection.sourceHandle || 'output',
        targetBlockId: connection.target,
        targetPortId: connection.targetHandle || 'input',
      };

      console.log('[useCanvasSync] Creating connection:', newConnection);
      addConnection(contextBlockId, newConnection);
      console.log('[useCanvasSync] Connection added to store');
    },
    [addConnection, contextBlockId, readOnly]
  );

  // Handle node click (selection)
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      console.log('[useCanvasSync] Node clicked:', { nodeId: node.id });
      selectBlock(node.id);
      if (onBlockSelect) {
        console.log('[useCanvasSync] Calling onBlockSelect callback');
        onBlockSelect(node.id);
      }
    },
    [selectBlock, onBlockSelect]
  );

  // Handle pane click (deselect)
  const handlePaneClick = useCallback(() => {
    console.log('[useCanvasSync] Pane clicked - deselecting');
    selectBlock(null);
    if (onBlockSelect) {
      console.log('[useCanvasSync] Calling onBlockSelect(null) callback');
      onBlockSelect(null);
    }
  }, [selectBlock, onBlockSelect]);
  
  // Handle drop on canvas
  const handleDrop = useCallback((event: React.DragEvent) => {
    console.log('[Canvas Drop] Event triggered', { 
      clientX: event.clientX, 
      clientY: event.clientY,
      readOnly,
      contextBlockId,
      hasOnDrop: !!onDrop 
    });
    
    if (readOnly || !contextBlockId) {
      console.log('[Canvas Drop] Aborted - readOnly mode or no context block');
      return;
    }
    
    if (!onDrop) {
      console.log('[Canvas Drop] Aborted - no onDrop handler');
      return;
    }
    
    event.preventDefault();
    
    // Get mouse position in screen coordinates
    const screenPosition = {
      x: event.clientX,
      y: event.clientY,
    };
    
    console.log('[Canvas Drop] Screen position:', screenPosition);
    
    // Convert screen coordinates to flow coordinates (accounting for zoom/pan)
    try {
      const flowPosition = screenToFlowPosition(screenPosition);
      console.log('[Canvas Drop] Flow position:', flowPosition);
      
      // Pass to parent handler with flow position
      onDrop(event, flowPosition);
      console.log('[Canvas Drop] Successfully passed to parent handler');
    } catch (error) {
      console.error('[Canvas Drop] Error converting coordinates:', error);
    }
  }, [readOnly, contextBlockId, onDrop, screenToFlowPosition]);

  return {
    nodes: localNodes,
    edges,
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect: handleConnect,
    onNodeClick: handleNodeClick,
    onPaneClick: handlePaneClick,
    onDrop: handleDrop,
    contextBlockId,
  };
}
