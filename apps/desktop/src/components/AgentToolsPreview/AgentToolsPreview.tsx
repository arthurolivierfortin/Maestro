/**
 * AgentToolsPreview Component
 *
 * Displays an agent's available tools as block-style nodes in a React Flow canvas.
 * Uses the same visual style as existing blocks in the system.
 * Edges are dashed and non-directional to show "can use" relationship.
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
import './AgentToolsPreview.scss';

interface ToolInfo {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

interface AgentToolsPreviewProps {
  agentId: string;
  agentName: string;
  tools: ToolInfo[];
  onToolClick?: (toolId: string) => void;
  onAgentClick?: () => void;
}

/**
 * Custom node component for the agent - styled like BaseBlockNode
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

/**
 * Custom node component for tools - styled like BaseBlockNode
 */
const ToolBlockNode = memo(({ data }: { data: { label: string; category?: string; onClick?: () => void } }) => {
  return (
    <div className="preview-block-node preview-block-node--tool" onClick={data.onClick}>
      <Handle type="target" position={Position.Left} id="input" className="preview-block-node__handle" />
      <div className="preview-block-node__header">
        <Wrench size={16} className="preview-block-node__icon" />
        <span className="preview-block-node__name">{data.label}</span>
      </div>
      <div className="preview-block-node__content">
        {data.category && (
          <span className="preview-block-node__category">{data.category}</span>
        )}
      </div>
    </div>
  );
});
ToolBlockNode.displayName = 'ToolBlockNode';

const nodeTypes = {
  agentBlock: AgentBlockNode,
  toolBlock: ToolBlockNode,
};

export function AgentToolsPreview({
  agentId,
  agentName,
  tools,
  onToolClick,
  onAgentClick,
}: AgentToolsPreviewProps) {
  // Generate nodes from agent and tools
  const { nodes, edges } = useMemo(() => {
    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    // Calculate layout based on number of tools
    const toolsPerRow = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(tools.length * 1.5))));
    const toolWidth = 160;
    const toolHeight = 75;
    const startX = 220;
    const startY = 20;
    const gapX = 20;
    const gapY = 15;

    // Calculate grid dimensions
    const rows = Math.ceil(tools.length / toolsPerRow);
    const gridHeight = rows * toolHeight + (rows - 1) * gapY;
    const agentY = startY + Math.max(0, (gridHeight / 2) - 40);

    // Agent node
    generatedNodes.push({
      id: agentId,
      type: 'agentBlock',
      position: { x: 20, y: agentY },
      data: {
        label: agentName,
        onClick: onAgentClick,
      },
    });

    // Tool nodes
    tools.forEach((tool, index) => {
      const row = Math.floor(index / toolsPerRow);
      const col = index % toolsPerRow;

      generatedNodes.push({
        id: `tool-${tool.id}`,
        type: 'toolBlock',
        position: {
          x: startX + col * (toolWidth + gapX),
          y: startY + row * (toolHeight + gapY),
        },
        data: {
          label: tool.name,
          category: tool.category,
          onClick: onToolClick ? () => onToolClick(tool.id) : undefined,
        },
      });

      // Create dashed edge from agent to tool (non-directional)
      generatedEdges.push({
        id: `edge-${agentId}-${tool.id}`,
        source: agentId,
        target: `tool-${tool.id}`,
        sourceHandle: 'output',
        targetHandle: 'input',
        type: 'default',
        style: {
          stroke: 'var(--border-color, #444)',
          strokeWidth: 1.5,
          strokeDasharray: '5,5',
        },
        // No arrow markers - shows "can use" relationship
      });
    });

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [agentId, agentName, tools, onToolClick, onAgentClick]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id.startsWith('tool-') && onToolClick) {
        const toolId = node.id.replace('tool-', '');
        onToolClick(toolId);
      } else if (node.id === agentId && onAgentClick) {
        onAgentClick();
      }
    },
    [agentId, onToolClick, onAgentClick]
  );

  if (tools.length === 0) {
    return (
      <div className="agent-tools-preview agent-tools-preview--empty">
        <p>No tools configured for this agent.</p>
      </div>
    );
  }

  return (
    <div className="agent-tools-preview">
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

export default AgentToolsPreview;
