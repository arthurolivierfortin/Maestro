/**
 * ToolUsagePreview Component
 *
 * Displays which agents use a tool in a React Flow canvas.
 * Uses block-style nodes matching BaseBlockNode appearance.
 * Edges are dashed and non-directional to show "uses" relationship.
 */

import { useMemo, useCallback, memo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  BackgroundVariant,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Bot, Wrench } from 'lucide-react';
import './ToolUsagePreview.scss';

interface AgentInfo {
  id: string;
  name: string;
}

interface ToolUsagePreviewProps {
  toolId: string;
  toolName: string;
  usedByAgents: AgentInfo[];
  onAgentClick?: (agentId: string) => void;
}

/**
 * Custom node component for the tool - styled like BaseBlockNode
 */
const ToolBlockNode = memo(({ data }: { data: { label: string } }) => {
  return (
    <div className="preview-block-node preview-block-node--tool">
      <Handle type="target" position={Position.Left} id="input" className="preview-block-node__handle" />
      <div className="preview-block-node__header">
        <Wrench size={16} className="preview-block-node__icon" />
        <span className="preview-block-node__name">{data.label}</span>
      </div>
      <div className="preview-block-node__content">
        <span className="preview-block-node__type">Tool</span>
      </div>
    </div>
  );
});
ToolBlockNode.displayName = 'ToolBlockNode';

/**
 * Custom node component for agents - styled like BaseBlockNode
 */
const AgentBlockNode = memo(({ data }: { data: { label: string; onClick?: () => void } }) => {
  return (
    <div className="preview-block-node preview-block-node--agent" onClick={data.onClick}>
      <Handle type="source" position={Position.Right} id="output" className="preview-block-node__handle" />
      <div className="preview-block-node__header">
        <Bot size={16} className="preview-block-node__icon" />
        <span className="preview-block-node__name">{data.label}</span>
      </div>
      <div className="preview-block-node__content">
        <span className="preview-block-node__type">Agent</span>
      </div>
    </div>
  );
});
AgentBlockNode.displayName = 'AgentBlockNode';

const nodeTypes = {
  toolBlock: ToolBlockNode,
  agentBlock: AgentBlockNode,
};

export function ToolUsagePreview({
  toolId,
  toolName,
  usedByAgents,
  onAgentClick,
}: ToolUsagePreviewProps) {
  // Generate nodes from tool and agents
  const { nodes, edges } = useMemo(() => {
    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    // Calculate layout based on number of agents
    const agentsPerCol = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(usedByAgents.length * 1.5))));
    const agentWidth = 160;
    const agentHeight = 75;
    const startX = 20;
    const startY = 20;
    const gapX = 20;
    const gapY = 15;

    // Calculate grid dimensions
    const cols = Math.ceil(usedByAgents.length / agentsPerCol);
    const gridWidth = cols * agentWidth + (cols - 1) * gapX;
    const toolX = startX + gridWidth + 80;

    // Calculate tool Y position to center it vertically with agents
    const rows = Math.min(agentsPerCol, usedByAgents.length);
    const gridHeight = rows * agentHeight + (rows - 1) * gapY;
    const toolY = startY + Math.max(0, (gridHeight / 2) - 40);

    // Tool node on the right
    generatedNodes.push({
      id: toolId,
      type: 'toolBlock',
      position: { x: toolX, y: toolY },
      data: { label: toolName },
    });

    // Agent nodes on the left in a grid
    usedByAgents.forEach((agent, index) => {
      const col = Math.floor(index / agentsPerCol);
      const row = index % agentsPerCol;

      generatedNodes.push({
        id: `agent-${agent.id}`,
        type: 'agentBlock',
        position: {
          x: startX + col * (agentWidth + gapX),
          y: startY + row * (agentHeight + gapY),
        },
        data: {
          label: agent.name,
          onClick: onAgentClick ? () => onAgentClick(agent.id) : undefined,
        },
      });

      // Create dashed edge from agent to tool (non-directional)
      generatedEdges.push({
        id: `edge-${agent.id}-${toolId}`,
        source: `agent-${agent.id}`,
        target: toolId,
        sourceHandle: 'output',
        targetHandle: 'input',
        type: 'default',
        style: {
          stroke: 'var(--border-color, #444)',
          strokeWidth: 1.5,
          strokeDasharray: '5,5',
        },
        // No arrow markers - shows "uses" relationship
      });
    });

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [toolId, toolName, usedByAgents, onAgentClick]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id.startsWith('agent-') && onAgentClick) {
        const agentId = node.id.replace('agent-', '');
        onAgentClick(agentId);
      }
    },
    [onAgentClick]
  );

  if (usedByAgents.length === 0) {
    return (
      <div className="tool-usage-preview tool-usage-preview--empty">
        <div className="preview-block-node preview-block-node--tool preview-block-node--standalone">
          <div className="preview-block-node__header">
            <Wrench size={16} className="preview-block-node__icon" />
            <span className="preview-block-node__name">{toolName}</span>
          </div>
          <div className="preview-block-node__content">
            <span className="preview-block-node__type">Tool</span>
          </div>
        </div>
        <p>This tool is not used by any agent yet.</p>
      </div>
    );
  }

  return (
    <div className="tool-usage-preview">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        zoomOnScroll={true}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default ToolUsagePreview;
