/**
 * Workspace Health Component
 *
 * Displays KPIs and health metrics for the workspace.
 */

import React from 'react';
import './WorkspaceHealth.scss';

interface HealthMetrics {
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  activeRuns: number;
  lastRunTime?: string;
  estimatedCost: number;
}

interface WorkspaceHealthProps {
  workspaceId: string;
  metrics?: HealthMetrics;
  onViewMetrics?: () => void;
}

// Default mock metrics
const DEFAULT_METRICS: HealthMetrics = {
  totalRuns: 127,
  successRate: 94,
  avgDuration: 2.3,
  activeRuns: 2,
  lastRunTime: new Date(Date.now() - 5 * 60000).toISOString(),
  estimatedCost: 0.00,
};

export const WorkspaceHealth: React.FC<WorkspaceHealthProps> = ({
  workspaceId: _workspaceId,
  metrics = DEFAULT_METRICS,
  onViewMetrics,
}) => {
  const formatRelativeTime = (dateStr?: string): string => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  };

  const getSuccessRateClass = (rate: number): string => {
    if (rate >= 90) return 'success';
    if (rate >= 70) return 'warning';
    return 'error';
  };

  return (
    <div className="workspace-health">
      <div className="workspace-health__header">
        <h3>Workspace Health</h3>
        {onViewMetrics && (
          <button className="workspace-health__view-btn" onClick={onViewMetrics}>
            📈 View Full Metrics
          </button>
        )}
      </div>

      <div className="workspace-health__grid">
        <div className="workspace-health__metric">
          <div className="workspace-health__metric-value">
            {metrics.totalRuns}
          </div>
          <div className="workspace-health__metric-label">Total Runs</div>
        </div>

        <div className="workspace-health__metric">
          <div className={`workspace-health__metric-value workspace-health__metric-value--${getSuccessRateClass(metrics.successRate)}`}>
            {metrics.successRate}%
          </div>
          <div className="workspace-health__metric-label">Success Rate</div>
        </div>

        <div className="workspace-health__metric">
          <div className="workspace-health__metric-value">
            {metrics.avgDuration}s
          </div>
          <div className="workspace-health__metric-label">Avg Duration</div>
        </div>

        <div className="workspace-health__metric">
          <div className={`workspace-health__metric-value ${metrics.activeRuns > 0 ? 'workspace-health__metric-value--active' : ''}`}>
            {metrics.activeRuns}
          </div>
          <div className="workspace-health__metric-label">Active</div>
        </div>

        <div className="workspace-health__metric">
          <div className="workspace-health__metric-value">
            {formatRelativeTime(metrics.lastRunTime)}
          </div>
          <div className="workspace-health__metric-label">Last Run</div>
        </div>

        <div className="workspace-health__metric">
          <div className="workspace-health__metric-value">
            ${metrics.estimatedCost.toFixed(2)}
          </div>
          <div className="workspace-health__metric-label">Est. Cost</div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceHealth;
