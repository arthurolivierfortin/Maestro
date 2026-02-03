/**
 * Session List Component
 *
 * Displays all sessions with filtering and actions.
 */

import React, { useState, useMemo } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import type { SessionSummary, SessionCategory } from '../../types/session.types';
import { SessionCard } from './SessionCard';
import { CreateSessionDialog } from './CreateSessionDialog';
import './SessionList.scss';

interface SessionListProps {
  sessions: SessionSummary[];
  categories: SessionCategory[];
  searchQuery: string;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  categories,
  searchQuery,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const startSession = useSessionStore((s) => s.startSession);
  const stopSession = useSessionStore((s) => s.stopSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let result = sessions;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.id.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((s) =>
        statusFilter === 'running' ? s.status === 'running' : s.status !== 'running'
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter((s) => s.categoryId === categoryFilter);
    }

    return result;
  }, [sessions, searchQuery, statusFilter, categoryFilter]);

  // Counts
  const runningCount = sessions.filter((s) => s.status === 'running').length;
  const stoppedCount = sessions.length - runningCount;

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || categoryId;
  };

  return (
    <div className="session-list">
      {/* Toolbar */}
      <div className="session-list__toolbar">
        <div className="session-list__filters">
          <button
            className={`session-list__filter ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All <span className="count">{sessions.length}</span>
          </button>
          <button
            className={`session-list__filter ${statusFilter === 'running' ? 'active' : ''}`}
            onClick={() => setStatusFilter('running')}
          >
            Running <span className="count">{runningCount}</span>
          </button>
          <button
            className={`session-list__filter ${statusFilter === 'stopped' ? 'active' : ''}`}
            onClick={() => setStatusFilter('stopped')}
          >
            Stopped <span className="count">{stoppedCount}</span>
          </button>

          <div className="session-list__divider" />

          <select
            className="session-list__category-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <button className="btn-primary" onClick={() => setShowCreateDialog(true)}>
          + New Session
        </button>
      </div>

      {/* Session grid */}
      {filteredSessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🖥️</div>
          <h2>
            {searchQuery
              ? 'No Sessions Found'
              : statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'No matching sessions'
              : 'No Sessions Yet'}
          </h2>
          <p>
            {searchQuery
              ? `No sessions match "${searchQuery}"`
              : 'Create a new session to get started'}
          </p>
          {!searchQuery && statusFilter === 'all' && categoryFilter === 'all' && (
            <button className="btn-primary" onClick={() => setShowCreateDialog(true)}>
              Create Your First Session
            </button>
          )}
        </div>
      ) : (
        <div className="session-list__grid">
          {filteredSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              categoryName={getCategoryName(session.categoryId)}
              onStart={() => startSession(session.id)}
              onStop={() => stopSession(session.id)}
              onDelete={() => deleteSession(session.id)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CreateSessionDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        categories={categories}
      />
    </div>
  );
};
