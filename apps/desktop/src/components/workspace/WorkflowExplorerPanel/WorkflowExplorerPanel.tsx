/**
 * WorkflowExplorerPanel Component
 *
 * Panel for exploring workflows in a workspace.
 * Shows a list of workflows with expandable cards containing flow diagrams.
 */

import React, { useMemo, useState } from 'react';
import { Workflow, Search } from 'lucide-react';
import { WorkflowCard } from './WorkflowCard';
import type { Block } from '../../../types/block.types';
import './WorkflowExplorerPanel.scss';

interface WorkflowExplorerPanelProps {
  blocks: Block[];
  onStartSession?: (workflowId: string) => void;
  onViewWorkflow?: (workflowId: string) => void;
}

export const WorkflowExplorerPanel: React.FC<WorkflowExplorerPanelProps> = ({
  blocks,
  onStartSession,
  onViewWorkflow,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(null);

  // Filter workflows from blocks
  const workflows = useMemo(() => {
    return blocks.filter(block => block.blockType === 'workflow');
  }, [blocks]);

  // Filter by search query
  const filteredWorkflows = useMemo(() => {
    if (!searchQuery.trim()) return workflows;

    const query = searchQuery.toLowerCase();
    return workflows.filter(workflow =>
      workflow.name.toLowerCase().includes(query) ||
      workflow.metadata?.description?.toLowerCase().includes(query)
    );
  }, [workflows, searchQuery]);

  const handleExpand = (workflowId: string) => {
    setExpandedWorkflowId(prev => prev === workflowId ? null : workflowId);
  };

  if (workflows.length === 0) {
    return (
      <div className="workflow-explorer-panel workflow-explorer-panel--empty">
        <div className="workflow-explorer-panel__empty-state">
          <Workflow size={48} strokeWidth={1.5} className="workflow-explorer-panel__empty-icon" />
          <h3>No Workflows</h3>
          <p>This workspace doesn't have any workflows yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="workflow-explorer-panel">
      {/* Header */}
      <div className="workflow-explorer-panel__header">
        <h2 className="workflow-explorer-panel__title">
          <Workflow size={20} />
          Workflows ({workflows.length})
        </h2>

        {/* Search */}
        <div className="workflow-explorer-panel__search">
          <Search size={16} className="workflow-explorer-panel__search-icon" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="workflow-explorer-panel__search-input"
          />
        </div>
      </div>

      {/* Workflow List */}
      <div className="workflow-explorer-panel__list">
        {filteredWorkflows.length === 0 ? (
          <div className="workflow-explorer-panel__no-results">
            <p>No workflows match your search.</p>
          </div>
        ) : (
          filteredWorkflows.map(workflow => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              isExpanded={expandedWorkflowId === workflow.id}
              onExpand={() => handleExpand(workflow.id)}
              onStartSession={() => onStartSession?.(workflow.id)}
              onView={() => onViewWorkflow?.(workflow.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default WorkflowExplorerPanel;
