/**
 * Session transforms — Pure functions for session data processing.
 * Zero dependencies. Used by both TUI and Frontend.
 */

export interface SessionSummary {
  id: string;
  name?: string;
  status?: string;
  progress?: number;
  variables?: Record<string, unknown>;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface SessionStatusCounts {
  total: number;
  running: number;
  completed: number;
  failed: number;
  pending: number;
  paused: number;
}

/**
 * Counts sessions by status.
 */
export function countByStatus(sessions: SessionSummary[]): SessionStatusCounts {
  const counts: SessionStatusCounts = {
    total: sessions.length,
    running: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    paused: 0,
  };

  for (const s of sessions) {
    const status = (s.status || '').toLowerCase();
    if (status === 'running' || status === 'active') counts.running++;
    else if (status === 'completed' || status === 'done' || status === 'success') counts.completed++;
    else if (status === 'failed' || status === 'error') counts.failed++;
    else if (status === 'pending' || status === 'waiting') counts.pending++;
    else if (status === 'paused') counts.paused++;
  }

  return counts;
}

/**
 * Filters sessions by status.
 */
export function filterByStatus(sessions: SessionSummary[], status: string): SessionSummary[] {
  const normalized = status.toLowerCase();
  return sessions.filter(s => (s.status || '').toLowerCase() === normalized);
}

/**
 * Returns only running/active sessions.
 */
export function filterRunning(sessions: SessionSummary[]): SessionSummary[] {
  return sessions.filter(s => {
    const status = (s.status || '').toLowerCase();
    return status === 'running' || status === 'active';
  });
}

/**
 * Extracts fitness value from session variables.
 */
export function extractFitness(session: SessionSummary): number | null {
  const vars = session.variables || {};
  const fitness = vars.currentFitness !== undefined ? vars.currentFitness : vars.fitness;
  if (fitness === undefined || fitness === null) return null;
  return Number(fitness);
}

/**
 * Maps a session status string to a semantic category for UI display.
 */
export function statusToSemantic(status: string | undefined): 'success' | 'info' | 'warning' | 'error' | 'muted' {
  switch ((status || '').toLowerCase()) {
    case 'running':
    case 'active':
      return 'info';
    case 'completed':
    case 'done':
    case 'success':
      return 'success';
    case 'failed':
    case 'error':
      return 'error';
    case 'paused':
      return 'warning';
    default:
      return 'muted';
  }
}
