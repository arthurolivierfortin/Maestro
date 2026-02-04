/**
 * HierarchyPanel Component
 *
 * Left sidebar panel showing the workspace hierarchy:
 * - Sessions list with status indicators
 * - Linked external workspaces
 * - Expandable tree structure
 * Uses Lucide icons for consistency with the rest of the app.
 */

import React, { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Layers,
  Link,
  Play,
  Pause,
  Clock,
  CheckCircle,
  XCircle,
  StopCircle,
  Circle,
} from 'lucide-react';
import type { Workspace } from '../../../types/workspace.types';
import type { Session, SessionStatus } from '../../../types/session.types';
import type { LinkedWorkspaceInfo } from '../../../types/workspace-canvas.types';
import './HierarchyPanel.scss';

interface HierarchyPanelProps {
  workspace: Workspace;
  sessions: Session[];
  linkedWorkspaces: LinkedWorkspaceInfo[];
  selectedId: string | null;
  selectedType: 'session' | 'workspace' | null;
  onSelect: (type: 'session' | 'workspace', id: string) => void;
  onDrillDown: (sessionId: string) => void;
}

const statusColors: Record<SessionStatus, string> = {
  Running: '#3b82f6',
  Pending: '#8b5cf6',
  Paused: '#f59e0b',
  Completed: '#22c55e',
  Failed: '#ef4444',
  Cancelled: '#6b7280',
};

const StatusIcon: React.FC<{ status: SessionStatus; size?: number }> = ({ status, size = 12 }) => {
  const color = statusColors[status] || '#6b7280';
  const props = { size, color };

  switch (status) {
    case 'Running':
      return <Play {...props} fill={color} />;
    case 'Pending':
      return <Clock {...props} />;
    case 'Paused':
      return <Pause {...props} />;
    case 'Completed':
      return <CheckCircle {...props} />;
    case 'Failed':
      return <XCircle {...props} />;
    case 'Cancelled':
      return <StopCircle {...props} />;
    default:
      return <Circle {...props} />;
  }
};

interface TreeNodeProps {
  label: string;
  icon?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  count?: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  label,
  icon,
  isExpanded,
  onToggle,
  children,
  count,
}) => (
  <div className="tree-node">
    <div className="tree-node__header" onClick={onToggle}>
      <span className="tree-node__chevron">
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </span>
      {icon && <span className="tree-node__icon">{icon}</span>}
      <span className="tree-node__label">{label}</span>
      {count !== undefined && (
        <span className="tree-node__count">{count}</span>
      )}
    </div>
    {isExpanded && children && (
      <div className="tree-node__children">{children}</div>
    )}
  </div>
);

export const HierarchyPanel: React.FC<HierarchyPanelProps> = ({
  workspace,
  sessions,
  linkedWorkspaces,
  selectedId,
  selectedType,
  onSelect,
  onDrillDown,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['sessions', 'linked'])
  );

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const isExpanded = (section: string) => expandedSections.has(section);

  // Group sessions by status
  const sessionsByStatus = sessions.reduce((acc, session) => {
    if (!acc[session.status]) {
      acc[session.status] = [];
    }
    acc[session.status].push(session);
    return acc;
  }, {} as Record<SessionStatus, Session[]>);

  const runningCount = sessionsByStatus['Running']?.length || 0;

  return (
    <div className="hierarchy-panel">
      {/* Workspace header */}
      <div className="hierarchy-panel__header">
        <div className="hierarchy-panel__workspace-icon">
          <Folder size={20} />
        </div>
        <div className="hierarchy-panel__workspace-info">
          <div className="hierarchy-panel__workspace-name">{workspace.name}</div>
          <div className="hierarchy-panel__workspace-type">{workspace.type}</div>
        </div>
        <div
          className={`hierarchy-panel__workspace-status hierarchy-panel__workspace-status--${workspace.status.toLowerCase()}`}
        />
      </div>

      {/* Quick stats */}
      <div className="hierarchy-panel__stats">
        <div className="hierarchy-panel__stat">
          <span className="hierarchy-panel__stat-value">{sessions.length}</span>
          <span className="hierarchy-panel__stat-label">Sessions</span>
        </div>
        <div className="hierarchy-panel__stat">
          <span className="hierarchy-panel__stat-value">{runningCount}</span>
          <span className="hierarchy-panel__stat-label">Running</span>
        </div>
        <div className="hierarchy-panel__stat">
          <span className="hierarchy-panel__stat-value">{linkedWorkspaces.length}</span>
          <span className="hierarchy-panel__stat-label">Linked</span>
        </div>
      </div>

      {/* Tree content */}
      <div className="hierarchy-panel__tree">
        {/* Sessions section */}
        <TreeNode
          label="Sessions"
          icon={<Layers size={14} />}
          isExpanded={isExpanded('sessions')}
          onToggle={() => toggleSection('sessions')}
          count={sessions.length}
        >
          {sessions.length === 0 ? (
            <div className="hierarchy-panel__empty">No sessions</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`hierarchy-panel__item ${
                  selectedType === 'session' && selectedId === session.id
                    ? 'hierarchy-panel__item--selected'
                    : ''
                }`}
                onClick={() => onSelect('session', session.id)}
                onDoubleClick={() => onDrillDown(session.id)}
              >
                <span className="hierarchy-panel__item-status">
                  <StatusIcon status={session.status} />
                </span>
                <span className="hierarchy-panel__item-name" title={session.id}>
                  {session.id.split('-').slice(0, 2).join('-')}
                </span>
                <span className="hierarchy-panel__item-badge">
                  {session.blocksCompleted}/{session.blocksTotal}
                </span>
              </div>
            ))
          )}
        </TreeNode>

        {/* Linked workspaces section */}
        {linkedWorkspaces.length > 0 && (
          <TreeNode
            label="Linked Workspaces"
            icon={<Link size={14} />}
            isExpanded={isExpanded('linked')}
            onToggle={() => toggleSection('linked')}
            count={linkedWorkspaces.length}
          >
            {linkedWorkspaces.map((ws) => (
              <div
                key={ws.id}
                className={`hierarchy-panel__item hierarchy-panel__item--external ${
                  selectedType === 'workspace' && selectedId === ws.id
                    ? 'hierarchy-panel__item--selected'
                    : ''
                }`}
                onClick={() => onSelect('workspace', ws.id)}
              >
                <span
                  className={`hierarchy-panel__item-online ${
                    ws.isOnline ? 'hierarchy-panel__item-online--active' : ''
                  }`}
                />
                <span className="hierarchy-panel__item-name" title={ws.name}>
                  {ws.name}
                </span>
                <span className="hierarchy-panel__item-relation">
                  {ws.relationshipType}
                </span>
              </div>
            ))}
          </TreeNode>
        )}

        {/* Info section */}
        <div className="hierarchy-panel__info">
          <div className="hierarchy-panel__info-row">
            <span className="hierarchy-panel__info-label">ID</span>
            <span className="hierarchy-panel__info-value" title={workspace.id}>
              {workspace.id.substring(0, 8)}...
            </span>
          </div>
          <div className="hierarchy-panel__info-row">
            <span className="hierarchy-panel__info-label">Projects</span>
            <span className="hierarchy-panel__info-value">
              {workspace.projectIds.length}
            </span>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="hierarchy-panel__hint">
        Double-click session to inspect blocks
      </div>
    </div>
  );
};

export default HierarchyPanel;
