/**
 * useWorkspaceLayout Hook
 *
 * Transforms workspace data (sessions, topology) into React Flow nodes and edges.
 * Uses Dagre for automatic graph layout with left-to-right direction.
 */

import { useMemo } from 'react';
import dagre from 'dagre';
import type { Node, Edge } from 'reactflow';
import type { Workspace, WorkspaceTopology } from '../../../../types/workspace.types';
import type { Session } from '../../../../types/session.types';
import type {
  SessionNodeData,
  ExternalWorkspaceNodeData,
  BlockPreview,
} from '../../../../types/workspace-canvas.types';

const SESSION_NODE_WIDTH = 280;
const SESSION_NODE_HEIGHT = 180;
const EXTERNAL_NODE_WIDTH = 220;
const EXTERNAL_NODE_HEIGHT = 120;

interface UseWorkspaceLayoutResult {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Transform a Session into SessionNodeData
 */
function sessionToNodeData(session: Session): SessionNodeData {
  // Create block previews from executions
  // Icons are rendered by the SessionNode component using BlockIcon
  const blockPreviews: BlockPreview[] = session.executions
    .slice(0, 8)
    .map((exec) => ({
      id: exec.blockId,
      name: exec.blockName,
      type: exec.blockType,
    }));

  return {
    sessionId: session.id,
    name: session.id.split('-').slice(0, 2).join('-'), // Shorten for display
    type: 'Session',
    status: session.status,
    blockCount: session.blocksTotal,
    activeBlockCount: session.blocksCompleted,
    startedAt: session.startedAt,
    progress:
      session.blocksTotal > 0
        ? {
            current: session.blocksCompleted,
            total: session.blocksTotal,
            label: `${session.blocksCompleted}/${session.blocksTotal} blocks`,
          }
        : undefined,
    metrics: {
      messagesProcessed: session.executions.length,
      errorsCount: session.executions.filter((e) => e.status === 'failed').length,
      lastActivity: session.recentLogs[0]?.timestamp || session.createdAt,
    },
    blockPreviews,
  };
}

/**
 * Hook to compute layout for workspace canvas
 */
export function useWorkspaceLayout(
  workspace: Workspace | null,
  sessions: Session[],
  topology: WorkspaceTopology | null
): UseWorkspaceLayoutResult {
  return useMemo(() => {
    if (!workspace) {
      return { nodes: [], edges: [] };
    }

    // Initialize dagre graph
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: 'LR', // Left to right
      nodesep: 80, // Horizontal spacing between nodes
      ranksep: 150, // Vertical spacing between ranks
      marginx: 50,
      marginy: 50,
    });

    // ===== Session Nodes =====
    const sessionNodes: Node<SessionNodeData>[] = sessions.map((session) => {
      // Add to dagre for layout calculation
      dagreGraph.setNode(session.id, {
        width: SESSION_NODE_WIDTH,
        height: SESSION_NODE_HEIGHT,
      });

      return {
        id: session.id,
        type: 'session',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: sessionToNodeData(session),
      };
    });

    // ===== External Workspace Nodes =====
    const externalNodes: Node<ExternalWorkspaceNodeData>[] = [];
    const externalWorkspaceIds = new Set<string>();

    // Find external workspaces from topology edges
    if (topology) {
      topology.edges.forEach((edge) => {
        if (edge.sourceWorkspaceId !== workspace.id) {
          externalWorkspaceIds.add(edge.sourceWorkspaceId);
        }
        if (edge.targetWorkspaceId !== workspace.id) {
          externalWorkspaceIds.add(edge.targetWorkspaceId);
        }
      });

      // Create nodes for external workspaces
      externalWorkspaceIds.forEach((wsId) => {
        const wsNode = topology.nodes.find((n) => n.workspaceId === wsId);
        if (wsNode) {
          // Add to dagre
          dagreGraph.setNode(wsId, {
            width: EXTERNAL_NODE_WIDTH,
            height: EXTERNAL_NODE_HEIGHT,
          });

          // Determine relationship type from edges
          const edge = topology.edges.find(
            (e) =>
              (e.sourceWorkspaceId === wsId && e.targetWorkspaceId === workspace.id) ||
              (e.targetWorkspaceId === wsId && e.sourceWorkspaceId === workspace.id)
          );

          externalNodes.push({
            id: wsId,
            type: 'externalWorkspace',
            position: { x: 0, y: 0 },
            data: {
              workspaceId: wsId,
              name: wsNode.name,
              type: wsNode.type as any,
              relationshipType: (edge?.edgeType as any) || 'read',
              isOnline: true, // TODO: Check actual status
              sessionCount: wsNode.sessionCount,
            },
          });
        }
      });
    }

    // ===== Edges =====
    const edges: Edge[] = [];

    // Add edges between sessions based on data flow
    // For now, connect sessions sequentially if there are multiple
    if (sessions.length > 1) {
      for (let i = 0; i < sessions.length - 1; i++) {
        const sourceId = sessions[i].id;
        const targetId = sessions[i + 1].id;

        dagreGraph.setEdge(sourceId, targetId);

        edges.push({
          id: `${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          type: 'dataFlow',
          data: {
            animated: sessions[i].status === 'Running',
            lastTransfer: sessions[i].recentLogs[0]?.timestamp,
          },
        });
      }
    }

    // Add edges from topology (workspace relationships)
    if (topology) {
      topology.edges.forEach((edge) => {
        const isSourceThisWorkspace = edge.sourceWorkspaceId === workspace.id;
        const isTargetThisWorkspace = edge.targetWorkspaceId === workspace.id;

        if (isSourceThisWorkspace || isTargetThisWorkspace) {
          // Connect from/to the first session or workspace node
          const internalNodeId = sessions[0]?.id || workspace.id;
          const externalNodeId = isSourceThisWorkspace
            ? edge.targetWorkspaceId
            : edge.sourceWorkspaceId;

          // Only add if external node exists
          if (externalWorkspaceIds.has(externalNodeId)) {
            const sourceId = isSourceThisWorkspace ? internalNodeId : externalNodeId;
            const targetId = isSourceThisWorkspace ? externalNodeId : internalNodeId;

            dagreGraph.setEdge(sourceId, targetId);

            // Map edge type to custom edge type
            const edgeTypeMap: Record<string, string> = {
              promotion: 'promotion',
              read: 'read',
              write: 'write',
            };

            edges.push({
              id: `${edge.sourceWorkspaceId}-${edge.targetWorkspaceId}-${edge.edgeType}`,
              source: sourceId,
              target: targetId,
              type: edgeTypeMap[edge.edgeType] || 'read',
              data: {
                relationshipType: edge.edgeType,
                animated: edge.edgeType === 'promotion',
              },
            });
          }
        }
      });
    }

    // ===== Run Dagre Layout =====
    dagre.layout(dagreGraph);

    // ===== Apply Calculated Positions =====
    const allNodes = [...sessionNodes, ...externalNodes];

    allNodes.forEach((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      if (nodeWithPosition) {
        const width =
          node.type === 'session' ? SESSION_NODE_WIDTH : EXTERNAL_NODE_WIDTH;
        const height =
          node.type === 'session' ? SESSION_NODE_HEIGHT : EXTERNAL_NODE_HEIGHT;

        node.position = {
          x: nodeWithPosition.x - width / 2,
          y: nodeWithPosition.y - height / 2,
        };
      }
    });

    return { nodes: allNodes, edges };
  }, [workspace, sessions, topology]);
}

export default useWorkspaceLayout;
