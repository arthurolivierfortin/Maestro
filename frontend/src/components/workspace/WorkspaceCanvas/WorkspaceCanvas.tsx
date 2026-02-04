/**
 * WorkspaceCanvas Component
 *
 * Main canvas component for visualizing workspace sessions and relationships.
 * Uses React Flow for the node-based visualization with custom nodes.
 * Inspired by Vivado Block Design visual style.
 */

import React, { useCallback, useEffect } from 'react';
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
import { Package } from 'lucide-react';

import { SessionNode } from './nodes/SessionNode';
import { ExternalWorkspaceNode } from './nodes/ExternalWorkspaceNode';
import { PromotionEdge, DataFlowEdge, MessageEdge, ReadWriteEdge } from './edges';
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout';

import type { Workspace, WorkspaceTopology } from '../../../types/workspace.types';
import type { Session } from '../../../types/session.types';
import type { SessionNodeData, ExternalWorkspaceNodeData } from '../../../types/workspace-canvas.types';

import './WorkspaceCanvas.scss';

// Import node styles
import './nodes/SessionNode.scss';
import './nodes/ExternalWorkspaceNode.scss';

interface WorkspaceCanvasProps {
  workspace: Workspace | null;
  sessions: Session[];
  topology: WorkspaceTopology | null;
  selectedId?: string | null;
  onSessionSelect?: (sessionId: string) => void;
  onSessionDrillDown?: (sessionId: string) => void;
  onExternalWorkspaceClick?: (workspaceId: string) => void;
  isLoading?: boolean;
}

// Define custom node types
const nodeTypes = {
  session: SessionNode,
  externalWorkspace: ExternalWorkspaceNode,
};

// Define custom edge types
const edgeTypes = {
  promotion: PromotionEdge,
  dataFlow: DataFlowEdge,
  message: MessageEdge,
  read: ReadWriteEdge,
  write: ReadWriteEdge,
};

// MiniMap node color function
function getNodeColor(node: Node<SessionNodeData | ExternalWorkspaceNodeData>): string {
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

export const WorkspaceCanvas: React.FC<WorkspaceCanvasProps> = ({
  workspace,
  sessions,
  topology,
  selectedId,
  onSessionSelect,
  onSessionDrillDown,
  onExternalWorkspaceClick,
  isLoading = false,
}) => {
  // Calculate layout
  const { nodes: layoutNodes, edges: layoutEdges } = useWorkspaceLayout(
    workspace,
    sessions,
    topology
  );

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
      }
    },
    [onSessionSelect, onExternalWorkspaceClick]
  );

  // Handle node double-click (drill-down)
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === 'session') {
        onSessionDrillDown?.(node.id);
      } else if (node.type === 'externalWorkspace') {
        // Navigate to external workspace
        onExternalWorkspaceClick?.(node.id);
      }
    },
    [onSessionDrillDown, onExternalWorkspaceClick]
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

  // No sessions state
  if (sessions.length === 0 && (!topology || topology.nodes.length <= 1)) {
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
          nodeColor={getNodeColor}
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
            <span className="workspace-canvas__session-count">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </Panel>

        {/* Legend panel */}
        <Panel position="bottom-right" className="workspace-canvas__legend-panel">
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
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default WorkspaceCanvas;
