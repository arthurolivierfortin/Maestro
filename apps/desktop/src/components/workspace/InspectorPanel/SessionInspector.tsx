/**
 * SessionInspector Component
 *
 * Displays detailed information about a selected session.
 * Shows status, progress, blocks, logs, and actions.
 * Uses Lucide icons and Button component for consistency.
 */

import React from 'react';
import {
  Layers,
  Play,
  Pause,
  Square,
  Search,
  XCircle,
  Clock,
  Calendar,
  Timer,
} from 'lucide-react';
import { Button } from '../../common/Button';
import type { Session, SessionStatus } from '../../../types/session.types';
import './SessionInspector.scss';

interface SessionInspectorProps {
  session: Session;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onViewLogs?: () => void;
  onDrillDown?: () => void;
}

const statusColors: Record<SessionStatus, string> = {
  Running: '#3b82f6',
  Pending: '#8b5cf6',
  Paused: '#f59e0b',
  Completed: '#22c55e',
  Failed: '#ef4444',
  Cancelled: '#6b7280',
};

const statusLabels: Record<SessionStatus, string> = {
  Running: 'Running',
  Pending: 'Pending',
  Paused: 'Paused',
  Completed: 'Completed',
  Failed: 'Failed',
  Cancelled: 'Cancelled',
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

export const SessionInspector: React.FC<SessionInspectorProps> = ({
  session,
  onPause,
  onResume,
  onStop,
  onViewLogs,
  onDrillDown,
}) => {
  const progressPercent = session.blocksTotal > 0
    ? Math.round((session.blocksCompleted / session.blocksTotal) * 100)
    : 0;

  const failedBlocks = session.executions.filter(e => e.status === 'failed');
  const runningBlock = session.executions.find(e => e.status === 'running');

  return (
    <div className="session-inspector">
      {/* Header */}
      <div className="session-inspector__header">
        <div className="session-inspector__title">
          <span className="session-inspector__icon">
            <Layers size={18} />
          </span>
          <span className="session-inspector__name">Session</span>
        </div>
        <div
          className="session-inspector__status"
          style={{ backgroundColor: statusColors[session.status] }}
        >
          {statusLabels[session.status]}
        </div>
      </div>

      {/* Session ID */}
      <div className="session-inspector__id">
        <code>{session.id}</code>
      </div>

      {/* Progress */}
      <div className="session-inspector__section">
        <div className="session-inspector__section-header">Progress</div>
        <div className="session-inspector__progress">
          <div className="session-inspector__progress-bar">
            <div
              className="session-inspector__progress-fill"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: statusColors[session.status],
              }}
            />
          </div>
          <div className="session-inspector__progress-label">
            {session.blocksCompleted} / {session.blocksTotal} blocks ({progressPercent}%)
          </div>
        </div>
      </div>

      {/* Current block */}
      {runningBlock && (
        <div className="session-inspector__section">
          <div className="session-inspector__section-header">Current Block</div>
          <div className="session-inspector__current-block">
            <span className="session-inspector__current-block-icon">
              <Play size={12} />
            </span>
            <span className="session-inspector__current-block-name">
              {runningBlock.blockName}
            </span>
            <span className="session-inspector__current-block-type">
              {runningBlock.blockType}
            </span>
          </div>
        </div>
      )}

      {/* Timing */}
      <div className="session-inspector__section">
        <div className="session-inspector__section-header">Timing</div>
        <div className="session-inspector__details">
          <div className="session-inspector__detail-row">
            <span className="session-inspector__detail-label">
              <Calendar size={12} /> Created
            </span>
            <span className="session-inspector__detail-value">
              {formatTimestamp(session.createdAt)}
            </span>
          </div>
          {session.startedAt && (
            <div className="session-inspector__detail-row">
              <span className="session-inspector__detail-label">
                <Clock size={12} /> Started
              </span>
              <span className="session-inspector__detail-value">
                {formatTimestamp(session.startedAt)}
              </span>
            </div>
          )}
          {session.completedAt && (
            <div className="session-inspector__detail-row">
              <span className="session-inspector__detail-label">
                <Clock size={12} /> Completed
              </span>
              <span className="session-inspector__detail-value">
                {formatTimestamp(session.completedAt)}
              </span>
            </div>
          )}
          {session.duration && (
            <div className="session-inspector__detail-row">
              <span className="session-inspector__detail-label">
                <Timer size={12} /> Duration
              </span>
              <span className="session-inspector__detail-value">
                {formatDuration(session.duration)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {session.error && (
        <div className="session-inspector__section session-inspector__section--error">
          <div className="session-inspector__section-header">Error</div>
          <div className="session-inspector__error">
            {session.error}
          </div>
        </div>
      )}

      {/* Failed blocks */}
      {failedBlocks.length > 0 && (
        <div className="session-inspector__section">
          <div className="session-inspector__section-header">
            Failed Blocks ({failedBlocks.length})
          </div>
          <div className="session-inspector__failed-blocks">
            {failedBlocks.slice(0, 3).map((block) => (
              <div key={block.blockId} className="session-inspector__failed-block">
                <span className="session-inspector__failed-block-icon">
                  <XCircle size={12} />
                </span>
                <span className="session-inspector__failed-block-name">
                  {block.blockName}
                </span>
                {block.error && (
                  <span className="session-inspector__failed-block-error">
                    {block.error.substring(0, 50)}...
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent logs */}
      {session.recentLogs.length > 0 && (
        <div className="session-inspector__section">
          <div className="session-inspector__section-header">
            Recent Logs
            {onViewLogs && (
              <Button
                variant="link"
                size="sm"
                onClick={onViewLogs}
              >
                View All
              </Button>
            )}
          </div>
          <div className="session-inspector__logs">
            {session.recentLogs.slice(0, 5).map((log, index) => (
              <div
                key={index}
                className={`session-inspector__log session-inspector__log--${log.level}`}
              >
                <span className="session-inspector__log-time">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="session-inspector__log-message">
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="session-inspector__actions">
        {session.status === 'Running' && onPause && (
          <Button variant="secondary" size="sm" icon={<Pause size={14} />} onClick={onPause}>
            Pause
          </Button>
        )}
        {session.status === 'Paused' && onResume && (
          <Button variant="primary" size="sm" icon={<Play size={14} />} onClick={onResume}>
            Resume
          </Button>
        )}
        {(session.status === 'Running' || session.status === 'Paused') && onStop && (
          <Button variant="danger" size="sm" icon={<Square size={14} />} onClick={onStop}>
            Stop
          </Button>
        )}
        {onDrillDown && (
          <Button variant="ghost" size="sm" icon={<Search size={14} />} onClick={onDrillDown}>
            Inspect Blocks
          </Button>
        )}
      </div>
    </div>
  );
};

export default SessionInspector;
