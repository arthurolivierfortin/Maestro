/**
 * InspectorPanel Component
 *
 * Right sidebar panel showing contextual details for the selected item.
 * Switches between SessionInspector and WorkspaceInspector based on selection.
 * Uses Lucide icons for consistency.
 */

import React from 'react';
import { MousePointer2 } from 'lucide-react';
import { SessionInspector } from './SessionInspector';
import { WorkspaceInspector } from './WorkspaceInspector';
import type { Session } from '../../../types/session.types';
import type { LinkedWorkspaceInfo } from '../../../types/workspace-canvas.types';
import './InspectorPanel.scss';

interface InspectorPanelProps {
  selectedType: 'session' | 'workspace' | null;
  selectedSession?: Session | null;
  selectedWorkspace?: LinkedWorkspaceInfo | null;
  onSessionPause?: () => void;
  onSessionResume?: () => void;
  onSessionStop?: () => void;
  onSessionViewLogs?: () => void;
  onSessionDrillDown?: () => void;
  onWorkspaceNavigate?: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedType,
  selectedSession,
  selectedWorkspace,
  onSessionPause,
  onSessionResume,
  onSessionStop,
  onSessionViewLogs,
  onSessionDrillDown,
  onWorkspaceNavigate,
}) => {
  // Empty state
  if (!selectedType || (selectedType === 'session' && !selectedSession) || (selectedType === 'workspace' && !selectedWorkspace)) {
    return (
      <div className="inspector-panel inspector-panel--empty">
        <div className="inspector-panel__empty-icon">
          <MousePointer2 size={48} strokeWidth={1.5} />
        </div>
        <div className="inspector-panel__empty-title">No Selection</div>
        <div className="inspector-panel__empty-hint">
          Select a session or workspace from the canvas or hierarchy to view details.
        </div>
      </div>
    );
  }

  return (
    <div className="inspector-panel">
      {selectedType === 'session' && selectedSession && (
        <SessionInspector
          session={selectedSession}
          onPause={onSessionPause}
          onResume={onSessionResume}
          onStop={onSessionStop}
          onViewLogs={onSessionViewLogs}
          onDrillDown={onSessionDrillDown}
        />
      )}

      {selectedType === 'workspace' && selectedWorkspace && (
        <WorkspaceInspector
          workspace={selectedWorkspace}
          onNavigate={onWorkspaceNavigate}
        />
      )}
    </div>
  );
};

export default InspectorPanel;
