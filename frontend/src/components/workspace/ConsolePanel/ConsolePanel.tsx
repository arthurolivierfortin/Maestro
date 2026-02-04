/**
 * ConsolePanel Component
 *
 * A terminal-like console panel for displaying workspace logs.
 * Supports filtering by level, session, and text search.
 * Uses Lucide icons for consistency with the rest of the app.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Settings,
  Info,
  AlertTriangle,
  XCircle,
  ArrowDown,
  Trash2,
  Minus,
  Menu,
  Search,
} from 'lucide-react';
import type { ConsoleLogEntry, ConsoleLogLevel } from '../../../types/workspace-canvas.types';
import './ConsolePanel.scss';

interface ConsolePanelProps {
  logs: ConsoleLogEntry[];
  onClear: () => void;
  isConnected?: boolean;
  sessionFilter?: string | null;
  onSessionFilterChange?: (sessionId: string | null) => void;
}

const LevelIcon: React.FC<{ level: ConsoleLogLevel; size?: number }> = ({ level, size = 12 }) => {
  const props = { size };
  switch (level) {
    case 'debug':
      return <Settings {...props} />;
    case 'info':
      return <Info {...props} />;
    case 'warn':
      return <AlertTriangle {...props} />;
    case 'error':
      return <XCircle {...props} />;
    default:
      return <Info {...props} />;
  }
};

const levelColors: Record<ConsoleLogLevel, string> = {
  debug: '#6b7280',
  info: '#3b82f6',
  warn: '#f59e0b',
  error: '#ef4444',
};

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  logs,
  onClear,
  isConnected = true,
  sessionFilter,
  onSessionFilterChange,
}) => {
  const [levelFilter, setLevelFilter] = useState<ConsoleLogLevel | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Level filter
      if (levelFilter !== 'all' && log.level !== levelFilter) {
        return false;
      }
      // Session filter
      if (sessionFilter && log.source.sessionId !== sessionFilter) {
        return false;
      }
      // Text search
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const matchesMessage = log.message.toLowerCase().includes(searchLower);
        const matchesSource = log.source.sessionName.toLowerCase().includes(searchLower);
        const matchesBlock = log.source.blockName?.toLowerCase().includes(searchLower);
        if (!matchesMessage && !matchesSource && !matchesBlock) {
          return false;
        }
      }
      return true;
    });
  }, [logs, levelFilter, sessionFilter, searchText]);

  // Get unique sessions for filter dropdown
  const uniqueSessions = useMemo(() => {
    const sessions = new Map<string, string>();
    logs.forEach((log) => {
      if (!sessions.has(log.source.sessionId)) {
        sessions.set(log.source.sessionId, log.source.sessionName);
      }
    });
    return Array.from(sessions.entries());
  }, [logs]);

  // Count by level
  const levelCounts = useMemo(() => {
    const counts: Record<ConsoleLogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    };
    logs.forEach((log) => {
      counts[log.level]++;
    });
    return counts;
  }, [logs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0; // Scroll to top since logs are newest-first
    }
  }, [filteredLogs, autoScroll]);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${timeStr}.${ms}`;
  }, []);

  const handleLevelToggle = useCallback((level: ConsoleLogLevel | 'all') => {
    setLevelFilter(level);
  }, []);

  if (!isExpanded) {
    return (
      <div className="console-panel console-panel--collapsed">
        <button
          className="console-panel__expand-button"
          onClick={() => setIsExpanded(true)}
          title="Expand Console"
        >
          <Menu size={14} className="console-panel__expand-icon" />
          <span>Console</span>
          {levelCounts.error > 0 && (
            <span className="console-panel__badge console-panel__badge--error">
              {levelCounts.error}
            </span>
          )}
          {levelCounts.warn > 0 && (
            <span className="console-panel__badge console-panel__badge--warn">
              {levelCounts.warn}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="console-panel">
      {/* Header */}
      <div className="console-panel__header">
        <div className="console-panel__title">
          <span
            className={`console-panel__connection-dot ${
              isConnected ? 'console-panel__connection-dot--connected' : ''
            }`}
          />
          <span>Console</span>
          <span className="console-panel__log-count">({filteredLogs.length})</span>
        </div>

        {/* Level filter buttons */}
        <div className="console-panel__filters">
          <button
            className={`console-panel__filter ${levelFilter === 'all' ? 'console-panel__filter--active' : ''}`}
            onClick={() => handleLevelToggle('all')}
            title="Show all"
          >
            All
          </button>
          {(['error', 'warn', 'info', 'debug'] as ConsoleLogLevel[]).map((level) => (
            <button
              key={level}
              className={`console-panel__filter console-panel__filter--${level} ${
                levelFilter === level ? 'console-panel__filter--active' : ''
              }`}
              onClick={() => handleLevelToggle(level)}
              title={`Show ${level} only`}
              style={{ color: levelFilter === level ? levelColors[level] : undefined }}
            >
              <LevelIcon level={level} size={12} /> {levelCounts[level]}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="console-panel__actions">
          <button
            className={`console-panel__action ${autoScroll ? 'console-panel__action--active' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
          >
            <ArrowDown size={14} />
          </button>
          <button className="console-panel__action" onClick={onClear} title="Clear console">
            <Trash2 size={14} />
          </button>
          <button
            className="console-panel__action"
            onClick={() => setIsExpanded(false)}
            title="Collapse"
          >
            <Minus size={14} />
          </button>
        </div>
      </div>

      {/* Search and session filter bar */}
      <div className="console-panel__search-bar">
        <div className="console-panel__search-wrapper">
          <Search size={14} className="console-panel__search-icon" />
          <input
            type="text"
            className="console-panel__search-input"
            placeholder="Filter logs..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        {uniqueSessions.length > 1 && (
          <select
            className="console-panel__session-select"
            value={sessionFilter || ''}
            onChange={(e) => onSessionFilterChange?.(e.target.value || null)}
          >
            <option value="">All Sessions</option>
            {uniqueSessions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Log entries */}
      <div className="console-panel__logs" ref={logContainerRef}>
        {filteredLogs.length === 0 ? (
          <div className="console-panel__empty">
            {logs.length === 0 ? 'No logs yet' : 'No logs match the current filters'}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`console-panel__entry console-panel__entry--${log.level}`}
            >
              <span
                className="console-panel__entry-level"
                style={{ color: levelColors[log.level] }}
              >
                <LevelIcon level={log.level} />
              </span>
              <span className="console-panel__entry-time">{formatTimestamp(log.timestamp)}</span>
              <span className="console-panel__entry-source">
                [{log.source.sessionName}
                {log.source.blockName && ` / ${log.source.blockName}`}]
              </span>
              <span className="console-panel__entry-message">{log.message}</span>
              {log.data && Object.keys(log.data).length > 0 && (
                <details className="console-panel__entry-data">
                  <summary>Data</summary>
                  <pre>{JSON.stringify(log.data, null, 2)}</pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConsolePanel;
