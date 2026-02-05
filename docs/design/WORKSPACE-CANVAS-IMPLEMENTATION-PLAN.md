# Workspace Canvas - Plan d'Implémentation Détaillé

## Document Technique - Spécifications d'Implémentation

**Version**: 1.0
**Date**: 2026-02-04
**Prérequis**: WORKSPACE-CANVAS-VISION.md

---

## Phase 1: Foundation (Canvas Statique)

### 1.1 Objectifs
- Afficher les sessions d'un workspace sur un canvas React Flow
- Afficher les workspaces liés comme nodes externes
- Afficher les edges de relation (promotion, read, write)
- Auto-layout avec dagre

### 1.2 Fichiers à créer

#### 1.2.1 `WorkspaceCanvas.tsx`

```typescript
// frontend/src/components/workspace/WorkspaceCanvas/WorkspaceCanvas.tsx

import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { SessionNode } from './nodes/SessionNode';
import { ExternalWorkspaceNode } from './nodes/ExternalWorkspaceNode';
import { DataFlowEdge } from './edges/DataFlowEdge';
import { PromotionEdge } from './edges/PromotionEdge';
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout';

import type { Workspace, WorkspaceTopology } from '../../../types/workspace.types';
import type { Session } from '../../../types/session.types';

interface WorkspaceCanvasProps {
  workspace: Workspace;
  sessions: Session[];
  topology: WorkspaceTopology;
  onSessionSelect?: (sessionId: string) => void;
  onSessionDrillDown?: (sessionId: string) => void;
  onExternalWorkspaceClick?: (workspaceId: string) => void;
}

const nodeTypes = {
  session: SessionNode,
  externalWorkspace: ExternalWorkspaceNode,
};

const edgeTypes = {
  dataFlow: DataFlowEdge,
  promotion: PromotionEdge,
};

export const WorkspaceCanvas: React.FC<WorkspaceCanvasProps> = ({
  workspace,
  sessions,
  topology,
  onSessionSelect,
  onSessionDrillDown,
  onExternalWorkspaceClick,
}) => {
  // Convert data to React Flow format
  const { nodes: layoutNodes, edges: layoutEdges } = useWorkspaceLayout(
    workspace,
    sessions,
    topology
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'session') {
      onSessionSelect?.(node.id);
    } else if (node.type === 'externalWorkspace') {
      onExternalWorkspaceClick?.(node.id);
    }
  }, [onSessionSelect, onExternalWorkspaceClick]);

  const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'session') {
      onSessionDrillDown?.(node.id);
    }
  }, [onSessionDrillDown]);

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
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#1a1a2e" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'session') return '#3b82f6';
            if (node.type === 'externalWorkspace') return '#10b981';
            return '#6b7280';
          }}
        />
      </ReactFlow>
    </div>
  );
};
```

#### 1.2.2 `SessionNode.tsx`

```typescript
// frontend/src/components/workspace/WorkspaceCanvas/nodes/SessionNode.tsx

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SessionNodeData } from '../../../../types/workspace-canvas.types';
import './SessionNode.scss';

const statusColors = {
  Active: '#22c55e',
  Running: '#3b82f6',
  Paused: '#f59e0b',
  Completed: '#6b7280',
  Failed: '#ef4444',
  Created: '#8b5cf6',
};

const statusIcons = {
  Active: '🟢',
  Running: '▶️',
  Paused: '⏸️',
  Completed: '✅',
  Failed: '❌',
  Created: '🔵',
};

export const SessionNode: React.FC<NodeProps<SessionNodeData>> = memo(({ data, selected }) => {
  const statusColor = statusColors[data.status] || '#6b7280';

  return (
    <div
      className={`session-node ${selected ? 'session-node--selected' : ''}`}
      style={{ borderColor: statusColor }}
    >
      <Handle type="target" position={Position.Left} />

      {/* Header */}
      <div className="session-node__header">
        <span className="session-node__status-icon">
          {statusIcons[data.status] || '⚪'}
        </span>
        <span className="session-node__name">{data.name}</span>
      </div>

      {/* Metadata */}
      <div className="session-node__meta">
        <span className="session-node__type">{data.type}</span>
        <span className="session-node__blocks">
          {data.activeBlockCount}/{data.blockCount} blocks
        </span>
      </div>

      {/* Block previews */}
      {data.blockPreviews && data.blockPreviews.length > 0 && (
        <div className="session-node__block-previews">
          {data.blockPreviews.slice(0, 5).map((block) => (
            <div
              key={block.id}
              className="session-node__block-icon"
              title={block.name}
            >
              {block.icon}
            </div>
          ))}
          {data.blockPreviews.length > 5 && (
            <div className="session-node__block-more">
              +{data.blockPreviews.length - 5}
            </div>
          )}
        </div>
      )}

      {/* Progress bar (if applicable) */}
      {data.progress && (
        <div className="session-node__progress">
          <div
            className="session-node__progress-bar"
            style={{
              width: `${(data.progress.current / data.progress.total) * 100}%`,
              backgroundColor: statusColor,
            }}
          />
          <span className="session-node__progress-label">
            {data.progress.label || `${data.progress.current}/${data.progress.total}`}
          </span>
        </div>
      )}

      {/* Status bar */}
      <div className="session-node__status-bar">
        {data.startedAt && (
          <span className="session-node__duration">
            Running for {formatDuration(data.startedAt)}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
});

SessionNode.displayName = 'SessionNode';

function formatDuration(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);

  if (diffMins > 60) {
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  }
  return `${diffMins}m ${diffSecs}s`;
}
```

#### 1.2.3 `useWorkspaceLayout.ts`

```typescript
// frontend/src/components/workspace/WorkspaceCanvas/hooks/useWorkspaceLayout.ts

import { useMemo } from 'react';
import dagre from 'dagre';
import type { Node, Edge } from 'reactflow';
import type { Workspace, WorkspaceTopology } from '../../../../types/workspace.types';
import type { Session } from '../../../../types/session.types';
import type { SessionNodeData, ExternalWorkspaceNodeData } from '../../../../types/workspace-canvas.types';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 180;

export function useWorkspaceLayout(
  workspace: Workspace,
  sessions: Session[],
  topology: WorkspaceTopology
): { nodes: Node[]; edges: Edge[] } {
  return useMemo(() => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 150 });

    // Add session nodes
    const sessionNodes: Node<SessionNodeData>[] = sessions.map((session) => {
      dagreGraph.setNode(session.id, { width: NODE_WIDTH, height: NODE_HEIGHT });

      return {
        id: session.id,
        type: 'session',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          sessionId: session.id,
          name: session.name,
          type: session.type,
          status: session.status,
          blockCount: session.blockIds?.length || 0,
          activeBlockCount: session.activeBlockCount || 0,
          startedAt: session.startedAt,
          progress: session.progress,
          blockPreviews: session.blockPreviews,
        },
      };
    });

    // Find external workspaces from topology
    const externalWorkspaceIds = new Set<string>();
    topology.edges.forEach((edge) => {
      if (edge.sourceWorkspaceId !== workspace.id) {
        externalWorkspaceIds.add(edge.sourceWorkspaceId);
      }
      if (edge.targetWorkspaceId !== workspace.id) {
        externalWorkspaceIds.add(edge.targetWorkspaceId);
      }
    });

    // Add external workspace nodes
    const externalNodes: Node<ExternalWorkspaceNodeData>[] = [];
    externalWorkspaceIds.forEach((wsId) => {
      const wsNode = topology.nodes.find((n) => n.workspaceId === wsId);
      if (wsNode) {
        dagreGraph.setNode(wsId, { width: NODE_WIDTH, height: 100 });
        externalNodes.push({
          id: wsId,
          type: 'externalWorkspace',
          position: { x: 0, y: 0 },
          data: {
            workspaceId: wsId,
            name: wsNode.name,
            type: wsNode.type as any,
            relationshipType: 'read', // Will be determined by edges
            isOnline: true, // TODO: Check actual status
          },
        });
      }
    });

    // Add edges
    const edges: Edge[] = [];

    // Session-to-session edges (data flow within workspace)
    // TODO: These would come from actual data flow configuration

    // Workspace-to-workspace edges (from topology)
    topology.edges.forEach((edge) => {
      if (edge.sourceWorkspaceId === workspace.id || edge.targetWorkspaceId === workspace.id) {
        // Connect to/from the workspace itself (represented by first session or center)
        const sourceId = edge.sourceWorkspaceId === workspace.id
          ? (sessions[0]?.id || workspace.id)
          : edge.sourceWorkspaceId;
        const targetId = edge.targetWorkspaceId === workspace.id
          ? (sessions[0]?.id || workspace.id)
          : edge.targetWorkspaceId;

        dagreGraph.setEdge(sourceId, targetId);

        edges.push({
          id: `${edge.sourceWorkspaceId}-${edge.targetWorkspaceId}-${edge.edgeType}`,
          source: sourceId,
          target: targetId,
          type: edge.edgeType === 'promotion' ? 'promotion' : 'dataFlow',
          animated: edge.edgeType === 'promotion',
          label: edge.edgeType,
        });
      }
    });

    // Run dagre layout
    dagre.layout(dagreGraph);

    // Apply calculated positions
    const allNodes = [...sessionNodes, ...externalNodes];
    allNodes.forEach((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      if (nodeWithPosition) {
        node.position = {
          x: nodeWithPosition.x - NODE_WIDTH / 2,
          y: nodeWithPosition.y - NODE_HEIGHT / 2,
        };
      }
    });

    return { nodes: allNodes, edges };
  }, [workspace, sessions, topology]);
}
```

### 1.3 Styles SCSS

```scss
// frontend/src/components/workspace/WorkspaceCanvas/nodes/SessionNode.scss

.session-node {
  background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
  border: 2px solid #3b82f6;
  border-radius: 12px;
  padding: 12px;
  min-width: 260px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 6px 30px rgba(59, 130, 246, 0.3);
    transform: translateY(-2px);
  }

  &--selected {
    border-color: #fff;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3), 0 6px 30px rgba(59, 130, 246, 0.4);
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  &__status-icon {
    font-size: 14px;
  }

  &__name {
    font-weight: 600;
    color: #fff;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #9ca3af;
    margin-bottom: 10px;
  }

  &__block-previews {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  &__block-icon {
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    cursor: default;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  &__block-more {
    width: 32px;
    height: 32px;
    background: rgba(59, 130, 246, 0.2);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #3b82f6;
  }

  &__progress {
    position: relative;
    height: 20px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  &__progress-bar {
    height: 100%;
    transition: width 0.3s ease;
  }

  &__progress-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 10px;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  &__status-bar {
    font-size: 10px;
    color: #6b7280;
    text-align: right;
  }

  // React Flow handles
  .react-flow__handle {
    width: 12px;
    height: 12px;
    background: #3b82f6;
    border: 2px solid #1e1e2e;

    &:hover {
      background: #60a5fa;
    }
  }
}
```

### 1.4 Tests

```typescript
// frontend/src/components/workspace/WorkspaceCanvas/__tests__/SessionNode.test.tsx

import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { SessionNode } from '../nodes/SessionNode';

const mockData = {
  sessionId: 'test-session',
  name: 'Test Session',
  type: 'ProjectSession' as const,
  status: 'Running' as const,
  blockCount: 5,
  activeBlockCount: 3,
  startedAt: new Date(Date.now() - 120000).toISOString(), // 2 mins ago
};

describe('SessionNode', () => {
  it('renders session name', () => {
    render(
      <ReactFlowProvider>
        <SessionNode
          id="test"
          data={mockData}
          selected={false}
          type="session"
          zIndex={0}
          isConnectable={true}
          xPos={0}
          yPos={0}
          dragging={false}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Test Session')).toBeInTheDocument();
  });

  it('shows running status icon', () => {
    render(
      <ReactFlowProvider>
        <SessionNode
          id="test"
          data={mockData}
          selected={false}
          type="session"
          zIndex={0}
          isConnectable={true}
          xPos={0}
          yPos={0}
          dragging={false}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByText('▶️')).toBeInTheDocument();
  });

  it('displays block count', () => {
    render(
      <ReactFlowProvider>
        <SessionNode
          id="test"
          data={mockData}
          selected={false}
          type="session"
          zIndex={0}
          isConnectable={true}
          xPos={0}
          yPos={0}
          dragging={false}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByText('3/5 blocks')).toBeInTheDocument();
  });
});
```

---

## Phase 2: Hierarchy & Inspector Panels

### 2.1 Objectifs
- Panneau hiérarchie navigable (arbre)
- Panneau inspecteur contextuel
- Synchronisation sélection entre les 3 zones
- Drill-down au double-click

### 2.2 Fichiers à créer

#### 2.2.1 `HierarchyPanel.tsx`

```typescript
// frontend/src/components/workspace/HierarchyPanel/HierarchyPanel.tsx

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, Play, Pause, Link } from 'lucide-react';
import type { Workspace } from '../../../types/workspace.types';
import type { Session } from '../../../types/session.types';
import './HierarchyPanel.scss';

interface HierarchyPanelProps {
  workspace: Workspace;
  sessions: Session[];
  linkedWorkspaces: { id: string; name: string; type: string }[];
  selectedId: string | null;
  onSelect: (type: 'session' | 'workspace' | 'block', id: string) => void;
  onDrillDown: (sessionId: string) => void;
}

export const HierarchyPanel: React.FC<HierarchyPanelProps> = ({
  workspace,
  sessions,
  linkedWorkspaces,
  selectedId,
  onSelect,
  onDrillDown,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(['sessions', 'linked'])
  );

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const isExpanded = (nodeId: string) => expandedNodes.has(nodeId);

  const getSessionIcon = (status: string) => {
    switch (status) {
      case 'Running':
      case 'Active':
        return <Play size={12} className="icon-running" />;
      case 'Paused':
        return <Pause size={12} className="icon-paused" />;
      default:
        return <span className="icon-dot" />;
    }
  };

  return (
    <div className="hierarchy-panel">
      <div className="hierarchy-panel__header">
        <Folder size={16} />
        <span>{workspace.name}</span>
      </div>

      <div className="hierarchy-panel__tree">
        {/* Sessions section */}
        <div className="tree-node">
          <div
            className="tree-node__header"
            onClick={() => toggleExpand('sessions')}
          >
            {isExpanded('sessions') ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            <span>Sessions ({sessions.length})</span>
          </div>

          {isExpanded('sessions') && (
            <div className="tree-node__children">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`tree-item ${
                    selectedId === session.id ? 'tree-item--selected' : ''
                  }`}
                  onClick={() => onSelect('session', session.id)}
                  onDoubleClick={() => onDrillDown(session.id)}
                >
                  {getSessionIcon(session.status)}
                  <span className="tree-item__name">{session.name}</span>
                  <span className="tree-item__badge">
                    {session.blockIds?.length || 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linked workspaces section */}
        {linkedWorkspaces.length > 0 && (
          <div className="tree-node">
            <div
              className="tree-node__header"
              onClick={() => toggleExpand('linked')}
            >
              {isExpanded('linked') ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              <span>Linked Workspaces ({linkedWorkspaces.length})</span>
            </div>

            {isExpanded('linked') && (
              <div className="tree-node__children">
                {linkedWorkspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className={`tree-item tree-item--external ${
                      selectedId === ws.id ? 'tree-item--selected' : ''
                    }`}
                    onClick={() => onSelect('workspace', ws.id)}
                  >
                    <Link size={12} />
                    <span className="tree-item__name">{ws.name}</span>
                    <span className="tree-item__type">{ws.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Blocks count */}
        <div className="tree-node">
          <div className="tree-node__header tree-node__header--info">
            <span>Total Blocks: {workspace.blockCount || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

#### 2.2.2 `InspectorPanel.tsx`

```typescript
// frontend/src/components/workspace/InspectorPanel/InspectorPanel.tsx

import React from 'react';
import type { Session } from '../../../types/session.types';
import type { Workspace } from '../../../types/workspace.types';
import { SessionInspector } from './SessionInspector';
import { WorkspaceInspector } from './WorkspaceInspector';
import './InspectorPanel.scss';

interface InspectorPanelProps {
  selectedType: 'session' | 'workspace' | 'block' | null;
  selectedSession?: Session;
  selectedWorkspace?: Workspace;
  onAction?: (action: string, data?: any) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedType,
  selectedSession,
  selectedWorkspace,
  onAction,
}) => {
  if (!selectedType) {
    return (
      <div className="inspector-panel inspector-panel--empty">
        <p>Select a session or workspace to view details</p>
      </div>
    );
  }

  return (
    <div className="inspector-panel">
      {selectedType === 'session' && selectedSession && (
        <SessionInspector
          session={selectedSession}
          onAction={onAction}
        />
      )}

      {selectedType === 'workspace' && selectedWorkspace && (
        <WorkspaceInspector
          workspace={selectedWorkspace}
          onAction={onAction}
        />
      )}
    </div>
  );
};
```

---

## Phase 3: Real-time Integration

### 3.1 Backend: WorkspaceHub

```csharp
// backend/src/Maestro.Api/Hubs/WorkspaceHub.cs

using Microsoft.AspNetCore.SignalR;

namespace Maestro.Api.Hubs;

/// <summary>
/// SignalR hub for workspace-level real-time events.
/// Aggregates events from all sessions within a workspace.
/// </summary>
public class WorkspaceHub : Hub<IWorkspaceClient>
{
    private readonly ILogger<WorkspaceHub> _logger;
    private static readonly Dictionary<string, HashSet<string>> _connectionWorkspaces = new();
    private static readonly object _lock = new();

    public WorkspaceHub(ILogger<WorkspaceHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Subscribe to workspace events (all sessions).
    /// </summary>
    public async Task JoinWorkspace(string workspaceId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"workspace-{workspaceId}");

        lock (_lock)
        {
            if (!_connectionWorkspaces.ContainsKey(Context.ConnectionId))
            {
                _connectionWorkspaces[Context.ConnectionId] = new HashSet<string>();
            }
            _connectionWorkspaces[Context.ConnectionId].Add(workspaceId);
        }

        _logger.LogInformation(
            "Connection {ConnectionId} joined workspace {WorkspaceId}",
            Context.ConnectionId, workspaceId);

        // Send current state
        await Clients.Caller.OnWorkspaceJoined(new WorkspaceJoinedMessage
        {
            WorkspaceId = workspaceId,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Unsubscribe from workspace events.
    /// </summary>
    public async Task LeaveWorkspace(string workspaceId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"workspace-{workspaceId}");

        lock (_lock)
        {
            _connectionWorkspaces[Context.ConnectionId]?.Remove(workspaceId);
        }

        _logger.LogInformation(
            "Connection {ConnectionId} left workspace {WorkspaceId}",
            Context.ConnectionId, workspaceId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        lock (_lock)
        {
            _connectionWorkspaces.Remove(Context.ConnectionId);
        }
        await base.OnDisconnectedAsync(exception);
    }

    // Static methods for broadcasting

    public static async Task BroadcastSessionStateChange(
        IHubContext<WorkspaceHub, IWorkspaceClient> hubContext,
        string workspaceId,
        SessionStateChangeMessage message)
    {
        await hubContext.Clients
            .Group($"workspace-{workspaceId}")
            .OnSessionStateChange(message);
    }

    public static async Task BroadcastSessionEvent(
        IHubContext<WorkspaceHub, IWorkspaceClient> hubContext,
        string workspaceId,
        WorkspaceSessionEventMessage message)
    {
        await hubContext.Clients
            .Group($"workspace-{workspaceId}")
            .OnSessionEvent(message);
    }

    public static async Task BroadcastMetricsUpdate(
        IHubContext<WorkspaceHub, IWorkspaceClient> hubContext,
        string workspaceId,
        WorkspaceMetricsMessage message)
    {
        await hubContext.Clients
            .Group($"workspace-{workspaceId}")
            .OnMetricsUpdate(message);
    }
}

public interface IWorkspaceClient
{
    Task OnWorkspaceJoined(WorkspaceJoinedMessage message);
    Task OnSessionStateChange(SessionStateChangeMessage message);
    Task OnSessionEvent(WorkspaceSessionEventMessage message);
    Task OnAgentEvent(WorkspaceAgentEventMessage message);
    Task OnMetricsUpdate(WorkspaceMetricsMessage message);
    Task OnPromotionEvent(PromotionEventMessage message);
}

// Message types
public record WorkspaceJoinedMessage
{
    public string WorkspaceId { get; init; } = string.Empty;
    public DateTime Timestamp { get; init; }
}

public record SessionStateChangeMessage
{
    public string SessionId { get; init; } = string.Empty;
    public string SessionName { get; init; } = string.Empty;
    public string OldStatus { get; init; } = string.Empty;
    public string NewStatus { get; init; } = string.Empty;
    public DateTime Timestamp { get; init; }
}

public record WorkspaceSessionEventMessage
{
    public string SessionId { get; init; } = string.Empty;
    public string SessionName { get; init; } = string.Empty;
    public string EventType { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string Level { get; init; } = "info";
    public DateTime Timestamp { get; init; }
    public Dictionary<string, object>? Data { get; init; }
}

public record WorkspaceAgentEventMessage
{
    public string SessionId { get; init; } = string.Empty;
    public string AgentId { get; init; } = string.Empty;
    public string AgentName { get; init; } = string.Empty;
    public string EventType { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public DateTime Timestamp { get; init; }
}

public record WorkspaceMetricsMessage
{
    public string WorkspaceId { get; init; } = string.Empty;
    public int ActiveSessionCount { get; init; }
    public int TotalBlockExecutions { get; init; }
    public int ErrorCount { get; init; }
    public double AverageLatencyMs { get; init; }
    public DateTime Timestamp { get; init; }
}

public record PromotionEventMessage
{
    public string SourceWorkspaceId { get; init; } = string.Empty;
    public string TargetWorkspaceId { get; init; } = string.Empty;
    public string BlockId { get; init; } = string.Empty;
    public string BlockName { get; init; } = string.Empty;
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
    public DateTime Timestamp { get; init; }
}
```

### 3.2 Frontend: useWorkspaceRealtime Hook

```typescript
// frontend/src/hooks/useWorkspaceRealtime.ts

import { useEffect, useState, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import type { SessionNodeData, ConsoleLogEntry } from '../types/workspace-canvas.types';

const WORKSPACE_HUB_URL = import.meta.env.VITE_WORKSPACE_HUB_URL || 'http://localhost:5000/hubs/workspace';

interface UseWorkspaceRealtimeReturn {
  isConnected: boolean;
  sessions: Map<string, SessionNodeData>;
  logs: ConsoleLogEntry[];
  metrics: WorkspaceMetrics | null;
  error: string | null;
  clearLogs: () => void;
}

interface WorkspaceMetrics {
  activeSessionCount: number;
  totalBlockExecutions: number;
  errorCount: number;
  averageLatencyMs: number;
  timestamp: string;
}

export function useWorkspaceRealtime(workspaceId: string | null): UseWorkspaceRealtimeReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [sessions, setSessions] = useState<Map<string, SessionNodeData>>(new Map());
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const maxLogs = 500;

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    if (!workspaceId) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(WORKSPACE_HUB_URL)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connectionRef.current = connection;

    // Event handlers
    connection.on('OnWorkspaceJoined', (message) => {
      console.log('[WorkspaceHub] Joined workspace', message.workspaceId);
    });

    connection.on('OnSessionStateChange', (message) => {
      setSessions((prev) => {
        const next = new Map(prev);
        const existing = next.get(message.sessionId);
        if (existing) {
          next.set(message.sessionId, {
            ...existing,
            status: message.newStatus,
          });
        }
        return next;
      });

      // Add to logs
      addLog({
        level: 'info',
        source: { sessionId: message.sessionId, sessionName: message.sessionName },
        message: `Status changed: ${message.oldStatus} → ${message.newStatus}`,
        timestamp: message.timestamp,
      });
    });

    connection.on('OnSessionEvent', (message) => {
      addLog({
        level: message.level as any,
        source: { sessionId: message.sessionId, sessionName: message.sessionName },
        message: message.message,
        timestamp: message.timestamp,
        data: message.data,
      });
    });

    connection.on('OnAgentEvent', (message) => {
      addLog({
        level: 'info',
        source: {
          sessionId: message.sessionId,
          sessionName: '',
          blockId: message.agentId,
          blockName: message.agentName,
        },
        message: `[${message.eventType}] ${message.message}`,
        timestamp: message.timestamp,
      });
    });

    connection.on('OnMetricsUpdate', (message) => {
      setMetrics({
        activeSessionCount: message.activeSessionCount,
        totalBlockExecutions: message.totalBlockExecutions,
        errorCount: message.errorCount,
        averageLatencyMs: message.averageLatencyMs,
        timestamp: message.timestamp,
      });
    });

    connection.on('OnPromotionEvent', (message) => {
      addLog({
        level: message.success ? 'info' : 'error',
        source: { sessionId: '', sessionName: 'Promotion' },
        message: message.success
          ? `Promoted ${message.blockName} to workspace ${message.targetWorkspaceId}`
          : `Promotion failed: ${message.errorMessage}`,
        timestamp: message.timestamp,
      });
    });

    // Connection lifecycle
    connection.onreconnecting(() => {
      setIsConnected(false);
      setError('Reconnecting...');
    });

    connection.onreconnected(() => {
      setIsConnected(true);
      setError(null);
      connection.invoke('JoinWorkspace', workspaceId);
    });

    connection.onclose(() => {
      setIsConnected(false);
    });

    // Start connection
    connection
      .start()
      .then(() => {
        setIsConnected(true);
        setError(null);
        return connection.invoke('JoinWorkspace', workspaceId);
      })
      .catch((err) => {
        setError(`Connection failed: ${err.message}`);
        console.error('[WorkspaceHub] Connection error:', err);
      });

    // Helper to add logs with limit
    function addLog(entry: Omit<ConsoleLogEntry, 'id'>) {
      setLogs((prev) => {
        const newLog: ConsoleLogEntry = {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        const next = [newLog, ...prev];
        return next.slice(0, maxLogs);
      });
    }

    // Cleanup
    return () => {
      if (connection.state === signalR.HubConnectionState.Connected) {
        connection.invoke('LeaveWorkspace', workspaceId).catch(() => {});
      }
      connection.stop();
    };
  }, [workspaceId]);

  return {
    isConnected,
    sessions,
    logs,
    metrics,
    error,
    clearLogs,
  };
}
```

---

## Phase 4: Console Panel

### 4.1 `ConsolePanel.tsx`

```typescript
// frontend/src/components/workspace/ConsolePanel/ConsolePanel.tsx

import React, { useState, useRef, useEffect } from 'react';
import { Filter, Trash2, Download, ChevronUp, ChevronDown } from 'lucide-react';
import type { ConsoleLogEntry } from '../../../types/workspace-canvas.types';
import { LogEntry } from './LogEntry';
import './ConsolePanel.scss';

interface ConsolePanelProps {
  logs: ConsoleLogEntry[];
  onClear: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

type LogLevel = 'all' | 'debug' | 'info' | 'warn' | 'error';

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  logs,
  onClear,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [filter, setFilter] = useState<LogLevel>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter((log) => {
    if (filter !== 'all' && log.level !== filter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(query) ||
        log.source.sessionName.toLowerCase().includes(query) ||
        log.source.blockName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0; // Logs are prepended, so scroll to top
    }
  }, [filteredLogs.length, autoScroll]);

  const handleExport = () => {
    const content = filteredLogs
      .map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source.sessionName}] ${log.message}`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isCollapsed) {
    return (
      <div className="console-panel console-panel--collapsed" onClick={onToggleCollapse}>
        <ChevronUp size={16} />
        <span>Console ({logs.length} entries)</span>
      </div>
    );
  }

  return (
    <div className="console-panel">
      <div className="console-panel__header">
        <div className="console-panel__title" onClick={onToggleCollapse}>
          <ChevronDown size={16} />
          <span>Console</span>
          <span className="console-panel__count">({filteredLogs.length})</span>
        </div>

        <div className="console-panel__filters">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="console-panel__search"
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as LogLevel)}
            className="console-panel__level-filter"
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>

          <button
            className="console-panel__btn"
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
          >
            {autoScroll ? '⏸' : '▶'}
          </button>

          <button className="console-panel__btn" onClick={handleExport} title="Export logs">
            <Download size={14} />
          </button>

          <button className="console-panel__btn" onClick={onClear} title="Clear logs">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="console-panel__logs" ref={scrollRef}>
        {filteredLogs.length === 0 ? (
          <div className="console-panel__empty">No logs to display</div>
        ) : (
          filteredLogs.map((log) => <LogEntry key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
};
```

---

## Phase 5 & 6: Edges, Polish, Views

Ces phases seront détaillées dans des documents séparés une fois les phases 1-4 validées.

---

## Annexe A: Dépendances à ajouter

```json
// package.json additions
{
  "dependencies": {
    "reactflow": "^11.10.0",
    "dagre": "^0.8.5",
    "@types/dagre": "^0.7.52"
  }
}
```

---

## Annexe B: Checklist de validation par phase

### Phase 1 Checklist
- [ ] `npm install reactflow dagre @types/dagre`
- [ ] WorkspaceCanvas affiche les sessions
- [ ] Nodes ont le bon design
- [ ] Layout automatique fonctionne
- [ ] Click sélectionne un node
- [ ] Double-click trigger drill-down callback
- [ ] Tests passent

### Phase 2 Checklist
- [ ] HierarchyPanel affiche l'arbre
- [ ] InspectorPanel affiche les détails
- [ ] Sélection synchronisée entre les 3 zones
- [ ] Drill-down navigue vers vue blocks

### Phase 3 Checklist
- [ ] WorkspaceHub enregistré dans Program.cs
- [ ] Frontend se connecte au hub
- [ ] État des sessions mis à jour en temps réel
- [ ] Indicateurs visuels de status live

### Phase 4 Checklist
- [ ] ConsolePanel affiche les logs
- [ ] Filtres fonctionnent
- [ ] Export fonctionne
- [ ] Auto-scroll fonctionne
