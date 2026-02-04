/**
 * WorkspaceLiveView Component
 *
 * Main layout component for the workspace canvas view.
 * Assembles HierarchyPanel (left), WorkspaceCanvas (center), and InspectorPanel (right).
 * Includes ConsolePanel at the bottom for real-time logs.
 * Manages selection synchronization between all panels.
 * Uses Lucide icons for consistency.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Radio, Pencil, Hexagon, List } from 'lucide-react';
import { HierarchyPanel } from '../HierarchyPanel';
import { WorkspaceCanvas } from '../WorkspaceCanvas';
import { InspectorPanel } from '../InspectorPanel';
import { ConsolePanel } from '../ConsolePanel';
import { useWorkspaceRealtime } from '../../../hooks/useWorkspaceRealtime';
import type { Workspace, WorkspaceTopology } from '../../../types/workspace.types';
import type { Session } from '../../../types/session.types';
import type { LinkedWorkspaceInfo, ViewMode } from '../../../types/workspace-canvas.types';
import './WorkspaceLiveView.scss';

// View mode configuration
const viewModes: { id: ViewMode; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'live', label: 'Live', icon: <Radio size={12} />, description: 'Real-time session monitoring' },
  { id: 'design', label: 'Design', icon: <Pencil size={12} />, description: 'Edit block structure' },
  { id: 'topology', label: 'Topology', icon: <Hexagon size={12} />, description: 'View workspace connections' },
  { id: 'timeline', label: 'Timeline', icon: <List size={12} />, description: 'Execution history' },
];

interface WorkspaceLiveViewProps {
  workspace: Workspace;
  sessions: Session[];
  topology: WorkspaceTopology | null;
  isLoading?: boolean;
  onNavigateToWorkspace?: (workspaceId: string) => void;
  onNavigateToLogs?: () => void;
}

export const WorkspaceLiveView: React.FC<WorkspaceLiveViewProps> = ({
  workspace,
  sessions,
  topology,
  isLoading = false,
  onNavigateToWorkspace,
  onNavigateToLogs,
}) => {
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('live');

  // Selection state
  const [selectedType, setSelectedType] = useState<'session' | 'workspace' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [consoleSessionFilter, setConsoleSessionFilter] = useState<string | null>(null);

  // Real-time connection
  const {
    isConnected,
    consoleLogs,
    clearConsoleLogs,
    metrics,
  } = useWorkspaceRealtime(workspace.id, { enabled: true });

  // Derive linked workspaces from topology
  const linkedWorkspaces = useMemo<LinkedWorkspaceInfo[]>(() => {
    if (!topology) return [];

    const externalIds = new Set<string>();
    const relationships = new Map<string, string>();

    topology.edges.forEach((edge) => {
      if (edge.sourceWorkspaceId !== workspace.id) {
        externalIds.add(edge.sourceWorkspaceId);
        relationships.set(edge.sourceWorkspaceId, edge.edgeType);
      }
      if (edge.targetWorkspaceId !== workspace.id) {
        externalIds.add(edge.targetWorkspaceId);
        relationships.set(edge.targetWorkspaceId, edge.edgeType);
      }
    });

    return Array.from(externalIds).map((wsId) => {
      const node = topology.nodes.find((n) => n.workspaceId === wsId);
      return {
        id: wsId,
        name: node?.name || wsId,
        type: (node?.type || 'Custom') as any,
        relationshipType: (relationships.get(wsId) || 'read') as any,
        isOnline: true, // TODO: Check actual status
        sessionCount: node?.sessionCount,
      };
    });
  }, [topology, workspace.id]);

  // Get selected session or workspace
  const selectedSession = useMemo(() => {
    if (selectedType !== 'session' || !selectedId) return null;
    return sessions.find((s) => s.id === selectedId) || null;
  }, [selectedType, selectedId, sessions]);

  const selectedWorkspace = useMemo(() => {
    if (selectedType !== 'workspace' || !selectedId) return null;
    return linkedWorkspaces.find((w) => w.id === selectedId) || null;
  }, [selectedType, selectedId, linkedWorkspaces]);

  // Selection handlers
  const handleSelect = useCallback((type: 'session' | 'workspace', id: string) => {
    setSelectedType(type);
    setSelectedId(id);
  }, []);

  const handleSessionSelect = useCallback((sessionId: string) => {
    handleSelect('session', sessionId);
  }, [handleSelect]);

  const handleExternalWorkspaceClick = useCallback((workspaceId: string) => {
    handleSelect('workspace', workspaceId);
  }, [handleSelect]);

  const handleDrillDown = useCallback((sessionId: string) => {
    // For now, just select the session
    // In the future, this could navigate to a detailed block view
    handleSelect('session', sessionId);
  }, [handleSelect]);

  // Action handlers
  const handleWorkspaceNavigate = useCallback(() => {
    if (selectedId && onNavigateToWorkspace) {
      onNavigateToWorkspace(selectedId);
    }
  }, [selectedId, onNavigateToWorkspace]);

  const handleSessionViewLogs = useCallback(() => {
    if (onNavigateToLogs) {
      onNavigateToLogs();
    }
  }, [onNavigateToLogs]);

  // TODO: Implement session control actions
  const handleSessionPause = useCallback(() => {
    console.log('Pause session:', selectedId);
  }, [selectedId]);

  const handleSessionResume = useCallback(() => {
    console.log('Resume session:', selectedId);
  }, [selectedId]);

  const handleSessionStop = useCallback(() => {
    console.log('Stop session:', selectedId);
  }, [selectedId]);

  return (
    <div className="workspace-live-view">
      {/* Left Panel: Hierarchy */}
      <aside className="workspace-live-view__hierarchy">
        <HierarchyPanel
          workspace={workspace}
          sessions={sessions}
          linkedWorkspaces={linkedWorkspaces}
          selectedId={selectedId}
          selectedType={selectedType}
          onSelect={handleSelect}
          onDrillDown={handleDrillDown}
        />
      </aside>

      {/* Center: Toolbar + Canvas + Console */}
      <div className="workspace-live-view__center">
        {/* Toolbar */}
        <div className="workspace-live-view__toolbar">
          {/* View Mode Switcher */}
          <div className="workspace-live-view__view-modes">
            {viewModes.map((mode) => (
              <button
                key={mode.id}
                className={`workspace-live-view__view-mode ${
                  viewMode === mode.id ? 'workspace-live-view__view-mode--active' : ''
                }`}
                onClick={() => setViewMode(mode.id)}
                title={mode.description}
              >
                <span className="workspace-live-view__view-mode-icon">{mode.icon}</span>
                <span>{mode.label}</span>
              </button>
            ))}
          </div>

          {/* Real-time Metrics */}
          <div className="workspace-live-view__metrics">
            <div className="workspace-live-view__metric">
              <span className={`workspace-live-view__connection-indicator ${
                isConnected ? 'workspace-live-view__connection-indicator--connected' : ''
              }`} />
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            {metrics && (
              <>
                <div className="workspace-live-view__metric">
                  <span className="workspace-live-view__metric-value">
                    {metrics.activeSessionCount}
                  </span>
                  <span className="workspace-live-view__metric-label">Active</span>
                </div>
                <div className="workspace-live-view__metric">
                  <span className="workspace-live-view__metric-value">
                    {metrics.totalBlockExecutions}
                  </span>
                  <span className="workspace-live-view__metric-label">Blocks</span>
                </div>
                {metrics.errorCount > 0 && (
                  <div className="workspace-live-view__metric workspace-live-view__metric--error">
                    <span className="workspace-live-view__metric-value">
                      {metrics.errorCount}
                    </span>
                    <span className="workspace-live-view__metric-label">Errors</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Canvas */}
        <main className="workspace-live-view__canvas">
          <WorkspaceCanvas
            workspace={workspace}
            sessions={sessions}
            topology={topology}
            selectedId={selectedId}
            onSessionSelect={handleSessionSelect}
            onSessionDrillDown={handleDrillDown}
            onExternalWorkspaceClick={handleExternalWorkspaceClick}
            isLoading={isLoading}
          />
        </main>

        {/* Bottom: Console */}
        <div className="workspace-live-view__console">
          <ConsolePanel
            logs={consoleLogs}
            onClear={clearConsoleLogs}
            isConnected={isConnected}
            sessionFilter={consoleSessionFilter}
            onSessionFilterChange={setConsoleSessionFilter}
          />
        </div>
      </div>

      {/* Right Panel: Inspector */}
      <aside className="workspace-live-view__inspector">
        <InspectorPanel
          selectedType={selectedType}
          selectedSession={selectedSession}
          selectedWorkspace={selectedWorkspace}
          onSessionPause={handleSessionPause}
          onSessionResume={handleSessionResume}
          onSessionStop={handleSessionStop}
          onSessionViewLogs={handleSessionViewLogs}
          onSessionDrillDown={() => selectedId && handleDrillDown(selectedId)}
          onWorkspaceNavigate={handleWorkspaceNavigate}
        />
      </aside>
    </div>
  );
};

export default WorkspaceLiveView;
