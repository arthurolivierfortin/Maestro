/**
 * WorkflowCard Component
 *
 * Expandable card showing workflow details and flow diagram.
 */

import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight, Play, Eye, Layers, Wrench, Bot } from 'lucide-react';
import { BlockIcon, blockColorMap } from '../../icons';
import { WorkflowFlowDiagram } from './WorkflowFlowDiagram';
import { Button } from '../../common/Button';
import type { Block } from '../../../types/block.types';
import './WorkflowCard.scss';

interface WorkflowCardProps {
  workflow: Block;
  isExpanded: boolean;
  onExpand: () => void;
  onStartSession?: () => void;
  onView?: () => void;
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({
  workflow,
  isExpanded,
  onExpand,
  onStartSession,
  onView,
}) => {
  // Count block types in the workflow
  const blockCounts = useMemo(() => {
    const counts = {
      total: 0,
      agents: 0,
      tools: 0,
      other: 0,
    };

    const countBlocks = (block: Block) => {
      counts.total++;
      switch (block.blockType) {
        case 'agent':
          counts.agents++;
          break;
        case 'tool':
          counts.tools++;
          break;
        default:
          counts.other++;
      }
      block.children?.forEach(countBlocks);
    };

    workflow.children?.forEach(countBlocks);
    return counts;
  }, [workflow]);

  // Get inputs and outputs from workflow config
  const inputs = workflow.inputs || [];
  const outputs = workflow.outputs || [];

  // Get tools used in workflow
  const tools = useMemo(() => {
    const toolList: Block[] = [];

    const collectTools = (block: Block) => {
      if (block.blockType === 'tool') {
        toolList.push(block);
      }
      block.children?.forEach(collectTools);
    };

    workflow.children?.forEach(collectTools);
    return toolList.slice(0, 8); // Limit to 8 for display
  }, [workflow]);

  return (
    <div className={`workflow-card ${isExpanded ? 'workflow-card--expanded' : ''}`}>
      {/* Header - Always Visible */}
      <button className="workflow-card__header" onClick={onExpand}>
        <div className="workflow-card__expand-icon">
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>

        <div className="workflow-card__icon">
          <BlockIcon type="workflow" size={24} />
        </div>

        <div className="workflow-card__info">
          <h3 className="workflow-card__name">{workflow.name}</h3>
          {workflow.metadata?.description && (
            <p className="workflow-card__description">{workflow.metadata.description}</p>
          )}
        </div>

        <div className="workflow-card__stats">
          <div className="workflow-card__stat" title="Total blocks">
            <Layers size={14} />
            <span>{blockCounts.total}</span>
          </div>
          {blockCounts.agents > 0 && (
            <div className="workflow-card__stat" title="Agents">
              <Bot size={14} style={{ color: blockColorMap.agent }} />
              <span>{blockCounts.agents}</span>
            </div>
          )}
          {blockCounts.tools > 0 && (
            <div className="workflow-card__stat" title="Tools">
              <Wrench size={14} style={{ color: blockColorMap.tool }} />
              <span>{blockCounts.tools}</span>
            </div>
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="workflow-card__content">
          {/* Flow Diagram */}
          <div className="workflow-card__diagram">
            <WorkflowFlowDiagram workflow={workflow} />
          </div>

          {/* Details Grid */}
          <div className="workflow-card__details">
            {/* Inputs */}
            {inputs.length > 0 && (
              <div className="workflow-card__detail-section">
                <h4>Inputs</h4>
                <ul className="workflow-card__port-list">
                  {inputs.map(input => (
                    <li key={input.id}>
                      <span className="workflow-card__port-name">{input.name}</span>
                      <span className="workflow-card__port-type">{input.dataType}</span>
                      {input.required && <span className="workflow-card__port-required">*</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Outputs */}
            {outputs.length > 0 && (
              <div className="workflow-card__detail-section">
                <h4>Outputs</h4>
                <ul className="workflow-card__port-list">
                  {outputs.map(output => (
                    <li key={output.id}>
                      <span className="workflow-card__port-name">{output.name}</span>
                      <span className="workflow-card__port-type">{output.dataType}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tools */}
            {tools.length > 0 && (
              <div className="workflow-card__detail-section">
                <h4>Tools Used</h4>
                <div className="workflow-card__tools">
                  {tools.map(tool => (
                    <div key={tool.id} className="workflow-card__tool-badge">
                      <BlockIcon type="tool" size={12} />
                      <span>{tool.name}</span>
                    </div>
                  ))}
                  {workflow.children && tools.length < blockCounts.tools && (
                    <span className="workflow-card__more">
                      +{blockCounts.tools - tools.length} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="workflow-card__actions">
            <Button
              variant="primary"
              size="sm"
              icon={<Play size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                onStartSession?.();
              }}
            >
              Start Session
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Eye size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                onView?.();
              }}
            >
              View Details
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowCard;
