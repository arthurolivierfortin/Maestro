/**
 * WorkspaceCanvas Component
 *
 * Main canvas component for visualizing workspace sessions and relationships.
 * Uses React Flow for the node-based visualization with custom nodes.
 * Supports multiple view modes: live (sessions), blueprint (static blocks), etc.
 * Inspired by Vivado Block Design visual style.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeMouseHandler,
  BackgroundVariant,
  Panel,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Package, Layers } from 'lucide-react';

import { SessionNode } from './nodes/SessionNode';
import { ExternalWorkspaceNode } from './nodes/ExternalWorkspaceNode';
import { BlueprintBlockNode } from './nodes/BlueprintBlockNode';
import { PromotionEdge, DataFlowEdge, MessageEdge, ReadWriteEdge, BlueprintEdge } from './edges';
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout';
import { useBlueprintLayout } from './hooks/useBlueprintLayout';
import { blockColorMap } from '../../icons';

import type { Workspace, WorkspaceTopology } from '../../../types/workspace.types';
import type { Session } from '../../../types/session.types';
import type { Block, BlockType } from '../../../types/block.types';
import type {
  SessionNodeData,
  ExternalWorkspaceNodeData,
  BlueprintBlockNodeData,
  ViewMode,
  EntryPoint,
} from '../../../types/workspace-canvas.types';

import './WorkspaceCanvas.scss';

// Import node styles
import './nodes/SessionNode.scss';
import './nodes/ExternalWorkspaceNode.scss';
import './nodes/BlueprintBlockNode.scss';

interface WorkspaceCanvasProps {
  workspace: Workspace | null;
  sessions: Session[];
  topology: WorkspaceTopology | null;
  selectedId?: string | null;
  onSessionSelect?: (sessionId: string) => void;
  onSessionDrillDown?: (sessionId: string) => void;
  onExternalWorkspaceClick?: (workspaceId: string) => void;
  onBlockSelect?: (blockId: string) => void;
  onBlockDrillDown?: (blockId: string) => void;
  isLoading?: boolean;
  viewMode?: ViewMode;
  blocks?: Block[];
  entryPoints?: EntryPoint[];
}

// Define custom node types
const nodeTypes = {
  session: SessionNode,
  externalWorkspace: ExternalWorkspaceNode,
  blueprintBlock: BlueprintBlockNode,
};

// Define custom edge types
const edgeTypes = {
  promotion: PromotionEdge,
  dataFlow: DataFlowEdge,
  message: MessageEdge,
  read: ReadWriteEdge,
  write: ReadWriteEdge,
  blueprint: BlueprintEdge,
};

// MiniMap node color function for live view
function getLiveNodeColor(node: Node<SessionNodeData | ExternalWorkspaceNodeData>): string {
  if (node.type === 'session') {
    const data = node.data as SessionNodeData;
    const statusColors: Record<string, string> = {
      Running: '#3b82f6',
      Pending: '#8b5cf6',
      Paused: '#f59e0b',
      Completed: '#22c55e',
      Failed: '#ef4444',
      Cancelled: '#6b7280',
    };
    return statusColors[data.status] || '#6b7280';
  }
  if (node.type === 'externalWorkspace') {
    return '#10b981';
  }
  return '#6b7280';
}

// MiniMap node color function for blueprint view
function getBlueprintNodeColor(node: Node<BlueprintBlockNodeData>): string {
  if (node.type === 'blueprintBlock') {
    const data = node.data as BlueprintBlockNodeData;
    return blockColorMap[data.blockType as BlockType] || '#6b7280';
  }
  return '#6b7280';
}

export const WorkspaceCanvas: React.FC<WorkspaceCanvasProps> = ({
  workspace,
  sessions,
  topology,
  selectedId,
  onSessionSelect,
  onSessionDrillDown,
  onExternalWorkspaceClick,
  onBlockSelect,
  onBlockDrillDown,
  isLoading = false,
  viewMode = 'live',
  blocks = [],
  entryPoints = [],
}) => {
  // Calculate layout for live view
  const { nodes: liveNodes, edges: liveEdges } = useWorkspaceLayout(
    workspace,
    sessions,
    topology
  );

  // Calculate layout for blueprint view
  const { nodes: blueprintNodes, edges: blueprintEdges } = useBlueprintLayout(
    blocks,
    entryPoints
  );

  // Select which layout to use based on view mode
  const { layoutNodes, layoutEdges } = useMemo(() => {
    if (viewMode === 'blueprint') {
      return { layoutNodes: blueprintNodes, layoutEdges: blueprintEdges };
    }
    return { layoutNodes: liveNodes, layoutEdges: liveEdges };
  }, [viewMode, liveNodes, liveEdges, blueprintNodes, blueprintEdges]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  // Update nodes when layout changes
  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  // Update selection
  useEffect(() => {
    if (selectedId) {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          selected: node.id === selectedId,
        }))
      );
    }
  }, [selectedId, setNodes]);

  // Handle node click
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === 'session') {
        onSessionSelect?.(node.id);
      } else if (node.type === 'externalWorkspace') {
        onExternalWorkspaceClick?.(node.id);
      } else if (node.type === 'blueprintBlock') {
        onBlockSelect?.(node.id);
      }
    },
    [onSessionSelect, onExternalWorkspaceClick, onBlockSelect]
  );

  // Handle node double-click (drill-down)
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === 'session') {
        onSessionDrillDown?.(node.id);
      } else if (node.type === 'externalWorkspace') {
        onExternalWorkspaceClick?.(node.id);
      } else if (node.type === 'blueprintBlock') {
        onBlockDrillDown?.(node.id);
      }
    },
    [onSessionDrillDown, onExternalWorkspaceClick, onBlockDrillDown]
  );

  // Empty state
  if (!workspace) {
    return (
      <div className="workspace-canvas workspace-canvas--empty">
        <p>No workspace selected</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="workspace-canvas workspace-canvas--loading">
        <div className="workspace-canvas__spinner" />
        <p>Loading workspace...</p>
      </div>
    );
  }

  // Empty state for blueprint mode
  if (viewMode === 'blueprint' && blocks.length === 0) {
    return (
      <div className="workspace-canvas workspace-canvas--empty">
        <div className="workspace-canvas__empty-icon">
          <Layers size={48} strokeWidth={1.5} />
        </div>
        <h3>No Blocks Defined</h3>
        <p>
          This workspace has no blocks yet.
          <br />
          Create blocks to see the structure.
        </p>
      </div>
    );
  }

  // Empty state for live mode
  if (viewMode !== 'blueprint' && sessions.length === 0 && (!topology || topology.nodes.length <= 1)) {
    return (
      <div className="workspace-canvas workspace-canvas--empty">
        <div className="workspace-canvas__empty-icon">
          <Package size={48} strokeWidth={1.5} />
        </div>
        <h3>No Active Sessions</h3>
        <p>
          This workspace has no active sessions yet.
          <br />
          Create a session to start working.
        </p>
      </div>
    );
  }

  // Select minimap color function based on view mode
  const getNodeColor = viewMode === 'blueprint' ? getBlueprintNodeColor : getLiveNodeColor;

  return (
    <div className="workspace-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
          },
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1.5}
          color="#4a4a6a"
        />

        <Controls
          showZoom
          showFitView
          showInteractive={false}
          className="workspace-canvas__controls"
        />

        <MiniMap
          nodeColor={getNodeColor as any}
          maskColor="rgba(0, 0, 0, 0.8)"
          className="workspace-canvas__minimap"
          zoomable
          pannable
        />

        {/* Status panel */}
        <Panel position="top-left" className="workspace-canvas__status-panel">
          <div className="workspace-canvas__status">
            <span className="workspace-canvas__workspace-name">
              {workspace.name}
            </span>
            {viewMode === 'blueprint' ? (
              <span className="workspace-canvas__block-count">
                {blocks.length} block{blocks.length !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="workspace-canvas__session-count">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </Panel>

        {/* Legend panel - different for each view mode */}
        <Panel position="bottom-right" className="workspace-canvas__legend-panel">
          {viewMode === 'blueprint' ? (
            <div className="workspace-canvas__legend">
              <div className="workspace-canvas__legend-title">Block Types</div>
              <div className="workspace-canvas__legend-item">
                <span className="workspace-canvas__legend-color" style={{ background: blockColorMap.workflow }} />
                <span>Workflow</span>
              </div>
              <div className="workspace-canvas__legend-item">
                <span className="workspace-canvas__legend-color" style={{ background: blockColorMap.agent }} />
                <span>Agent</span>
              </div>
              <div className="workspace-canvas__legend-item">
                <span className="workspace-canvas__legend-color" style={{ background: blockColorMap.tool }} />
                <span>Tool</span>
              </div>
              <div className="workspace-canvas__legend-item">
                <span className="workspace-canvas__legend-color" style={{ background: '#f59e0b' }} />
                <span>Entry Point</span>
              </div>
            </div>
          ) : (
            <div className="workspace-canvas__legend">
              <div className="workspace-canvas__legend-title">Legend</div>
              <div className="workspace-canvas__legend-item">
                <span className="workspace-canvas__legend-color" style={{ background: '#3b82f6' }} />
                <span>Running</span>
              </div>
              <div className="workspace-canvas__legend-item">
                <span className="workspace-canvas__legend-color" style={{ background: '#22c55e' }} />
                <span>Completed</span>
              </div>
              <div className="workspace-canvas__legend-item">
                <span className="workspace-canvas__legend-color" style={{ background: '#ef4444' }} />
                <span>Failed</span>
              </div>
              <div className="workspace-canvas__legend-item">
                <span className="workspace-canvas__legend-color workspace-canvas__legend-color--dashed" style={{ borderColor: '#10b981' }} />
                <span>External Workspace</span>
              </div>
            </div>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default WorkspaceCanvas;
