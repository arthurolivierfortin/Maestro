/**
 * Logs Panel Component
 *
 * Displays execution logs for the workspace with filtering capabilities.
 */

import React, { useState, useMemo } from 'react';
import './LogsPanel.scss';

interface ExecutionLog {
  id: string;
  blockId: string;
  blockName: string;
  blockType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
}

interface LogsPanelProps {
  workspaceId: string;
}

type StatusFilter = 'all' | 'completed' | 'failed' | 'running';
type TimeFilter = 'all' | '1h' | '24h' | '7d';

// Mock data for demonstration - in production, this would come from an API
const MOCK_LOGS: ExecutionLog[] = [
  {
    id: 'exec-001',
    blockId: 'block-1',
    blockName: 'Fitness Calculator',
    blockType: 'tool',
    status: 'completed',
    startedAt: new Date(Date.now() - 2 * 60000).toISOString(),
    completedAt: new Date(Date.now() - 2 * 60000 + 1200).toISOString(),
    duration: 1200,
    input: { modelId: 'smollm2:1.7b' },
    output: { totalFitness: 0.847, qualityScore: 0.82, speedScore: 0.91 },
  },
  {
    id: 'exec-002',
    blockId: 'block-2',
    blockName: 'Trainer Agent',
    blockType: 'agent',
    status: 'completed',
    startedAt: new Date(Date.now() - 5 * 60000).toISOString(),
    completedAt: new Date(Date.now() - 5 * 60000 + 45300).toISOString(),
    duration: 45300,
    input: { strategy: 'rl-fitness', iterations: 100 },
    output: { completedIterations: 34, bestFitness: 0.741 },
  },
  {
    id: 'exec-003',
    blockId: 'block-3',
    blockName: 'Experiment Pipeline',
    blockType: 'workflow',
    status: 'running',
    startedAt: new Date(Date.now() - 10 * 60000).toISOString(),
    input: { experimentId: 'exp-001' },
  },
  {
    id: 'exec-004',
    blockId: 'block-4',
    blockName: 'Tester Agent',
    blockType: 'agent',
    status: 'failed',
    startedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    completedAt: new Date(Date.now() - 15 * 60000 + 30000).toISOString(),
    duration: 30000,
    input: { testSuite: 'full' },
    error: 'Timeout after 30000ms',
  },
];

const STATUS_ICONS: Record<string, string> = {
  completed: '✅',
  failed: '❌',
  running: '⏳',
  pending: '🕐',
};

const BLOCK_TYPE_ICONS: Record<string, string> = {
  tool: '🔧',
  agent: '🤖',
  workflow: '🔄',
  prompt: '💬',
  inference: '🧠',
};

export const LogsPanel: React.FC<LogsPanelProps> = ({ workspaceId: _workspaceId }) => {
  const [logs] = useState<ExecutionLog[]>(MOCK_LOGS);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Status filter
      if (statusFilter !== 'all' && log.status !== statusFilter) {
        return false;
      }

      // Time filter
      if (timeFilter !== 'all') {
        const logTime = new Date(log.startedAt).getTime();
        const now = Date.now();
        const hours = {
          '1h': 1,
          '24h': 24,
          '7d': 24 * 7,
        }[timeFilter];
        if (now - logTime > hours * 60 * 60 * 1000) {
          return false;
        }
      }

      return true;
    });
  }, [logs, statusFilter, timeFilter]);

  const formatDuration = (ms?: number): string => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  };

  const toggleExpand = (logId: string) => {
    setExpandedLogId(prev => prev === logId ? null : logId);
  };

  return (
    <div className="logs-panel">
      {/* Header */}
      <div className="logs-panel__header">
        <h2>Execution Logs</h2>
        <button className="logs-panel__refresh">
          ↻ Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="logs-panel__filters">
        <div className="logs-panel__filter-group">
          <label>Status:</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
          </select>
        </div>

        <div className="logs-panel__filter-group">
          <label>Time:</label>
          <select
            value={timeFilter}
            onChange={e => setTimeFilter(e.target.value as TimeFilter)}
          >
            <option value="all">All Time</option>
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="logs-panel__list">
        {filteredLogs.length === 0 ? (
          <div className="logs-panel__empty">
            <div className="logs-panel__empty-icon">📜</div>
            <p>No execution logs found.</p>
            <p className="logs-panel__empty-hint">
              Execute a block to see logs here.
            </p>
          </div>
        ) : (
          filteredLogs.map(log => (
            <div
              key={log.id}
              className={`log-entry log-entry--${log.status} ${expandedLogId === log.id ? 'expanded' : ''}`}
            >
              <div className="log-entry__header" onClick={() => toggleExpand(log.id)}>
                <div className="log-entry__info">
                  <span className="log-entry__status">
                    {STATUS_ICONS[log.status]}
                  </span>
                  <span className="log-entry__icon">
                    {BLOCK_TYPE_ICONS[log.blockType] || '📦'}
                  </span>
                  <span className="log-entry__block-name">{log.blockName}</span>
                  <span className="log-entry__id">{log.id}</span>
                </div>
                <div className="log-entry__meta">
                  <span className="log-entry__time">{formatRelativeTime(log.startedAt)}</span>
                  <span className="log-entry__duration">{formatDuration(log.duration)}</span>
                  <span className="log-entry__expand">{expandedLogId === log.id ? '▼' : '▶'}</span>
                </div>
              </div>

              {expandedLogId === log.id && (
                <div className="log-entry__details">
                  <div className="log-entry__section">
                    <h4>Execution Details</h4>
                    <dl className="log-entry__dl">
                      <dt>Started:</dt>
                      <dd>{new Date(log.startedAt).toLocaleString()}</dd>
                      {log.completedAt && (
                        <>
                          <dt>Completed:</dt>
                          <dd>{new Date(log.completedAt).toLocaleString()}</dd>
                        </>
                      )}
                      <dt>Duration:</dt>
                      <dd>{formatDuration(log.duration)}</dd>
                      <dt>Block Type:</dt>
                      <dd>{log.blockType}</dd>
                    </dl>
                  </div>

                  {log.input && (
                    <div className="log-entry__section">
                      <h4>Input</h4>
                      <pre className="log-entry__code">
                        {JSON.stringify(log.input, null, 2)}
                      </pre>
                    </div>
                  )}

                  {log.output && (
                    <div className="log-entry__section">
                      <h4>Output</h4>
                      <pre className="log-entry__code">
                        {JSON.stringify(log.output, null, 2)}
                      </pre>
                    </div>
                  )}

                  {log.error && (
                    <div className="log-entry__section log-entry__section--error">
                      <h4>Error</h4>
                      <pre className="log-entry__code log-entry__code--error">
                        {log.error}
                      </pre>
                    </div>
                  )}

                  <div className="log-entry__actions">
                    {log.status === 'failed' && (
                      <button className="btn btn-secondary">
                        🔄 Retry
                      </button>
                    )}
                    <button className="btn btn-secondary">
                      📋 Copy ID
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogsPanel;
