/**
 * useSessionList — Shared hook for fetching and processing session lists.
 *
 * Pure React hook. Works in both TUI and Frontend.
 */

import { useCallback, useMemo } from 'react';
import { usePolling } from './usePolling.ts';
import {
  countByStatus,
  filterRunning,
  type SessionSummary,
  type SessionStatusCounts,
} from '../transforms/session.ts';

export interface SessionListState {
  sessions: SessionSummary[];
  counts: SessionStatusCounts;
  running: SessionSummary[];
  connectionStatus: 'connecting' | 'connected' | 'error';
  latency: number;
  lastRefresh: Date | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches and processes a session list with status counts.
 *
 * @param fetchSessions - Async function returning SessionSummary[]
 * @param interval - Poll interval (default 5000ms)
 */
export function useSessionList(
  fetchSessions: () => Promise<SessionSummary[]>,
  interval = 5000
): SessionListState {
  const {
    data,
    connectionStatus,
    latency,
    lastRefresh,
    refresh,
  } = usePolling(
    useCallback((): Promise<any> => fetchSessions().catch((): never[] => []), [fetchSessions]),
    interval
  );

  const sessions = data || [];
  const counts = useMemo(() => countByStatus(sessions), [sessions]);
  const running = useMemo(() => filterRunning(sessions), [sessions]);

  return {
    sessions,
    counts,
    running,
    connectionStatus,
    latency,
    lastRefresh,
    refresh,
  };
}
