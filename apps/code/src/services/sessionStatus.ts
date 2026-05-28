/**
 * Session status vocabulary — pure mapping functions.
 *
 * The backend canonical enum `SessionStatus` (Maestro.Domain/Enums/SessionEnums.cs)
 * serialises lowercase as: created, running, idle, paused, completed, failed,
 * cancelled, stopped. Historical/legacy data observed live on :5000 additionally
 * contains: done, error, new, pending, updated. The frontend is a pure consumer
 * and must handle every one of these gracefully — plus `active`, the string the
 * old UI/tests used for "live" (the backend never emits it).
 *
 * This module is the single source of truth for status semantics. No status
 * switch should live inline in components.
 */

export type SessionStatusGroup =
  | 'active'
  | 'idle'
  | 'pending'
  | 'paused'
  | 'done'
  | 'error'
  | 'neutral';

interface StatusSpec {
  group: SessionStatusGroup;
  canStart: boolean;
  canStop: boolean;
  canPause: boolean;
  canResume: boolean;
  /** Phosphor text-colour helper class from tui-theme.css. */
  colorClass: string;
}

// Exhaustive table keyed by lowercase status. Group is the semantic bucket;
// the per-status flags/colour are derived here because statuses in the same
// group can differ (e.g. `created`/`new` vs `pending` are all "pending" group
// but the former are start-only/accent and the latter is stop-only/warn).
const STATUS_TABLE: Record<string, StatusSpec> = {
  // --- canonical ---
  running: { group: 'active', canStart: false, canStop: true, canPause: true, canResume: false, colorClass: 'cok' },
  idle: { group: 'idle', canStart: true, canStop: true, canPause: false, canResume: false, colorClass: 'cok' },
  paused: { group: 'paused', canStart: false, canStop: true, canPause: false, canResume: true, colorClass: 'cwarn' },
  created: { group: 'pending', canStart: true, canStop: false, canPause: false, canResume: false, colorClass: 'ca' },
  completed: { group: 'done', canStart: true, canStop: false, canPause: false, canResume: false, colorClass: 'c3' },
  failed: { group: 'error', canStart: true, canStop: false, canPause: false, canResume: false, colorClass: 'cerr' },
  cancelled: { group: 'done', canStart: true, canStop: false, canPause: false, canResume: false, colorClass: 'c3' },
  stopped: { group: 'done', canStart: true, canStop: false, canPause: false, canResume: false, colorClass: 'c3' },
  // --- legacy data ---
  done: { group: 'done', canStart: true, canStop: false, canPause: false, canResume: false, colorClass: 'c3' },
  error: { group: 'error', canStart: true, canStop: false, canPause: false, canResume: false, colorClass: 'cerr' },
  new: { group: 'pending', canStart: true, canStop: false, canPause: false, canResume: false, colorClass: 'ca' },
  pending: { group: 'pending', canStart: false, canStop: true, canPause: false, canResume: false, colorClass: 'cwarn' },
  updated: { group: 'neutral', canStart: false, canStop: false, canPause: false, canResume: false, colorClass: 'c2' },
  // --- frontend-legacy (backend never emits it) ---
  active: { group: 'active', canStart: false, canStop: true, canPause: true, canResume: false, colorClass: 'cok' },
};

// Safe default for any unknown / future status: neutral, no dangerous action.
const NEUTRAL: StatusSpec = {
  group: 'neutral',
  canStart: false,
  canStop: false,
  canPause: false,
  canResume: false,
  colorClass: 'c2',
};

function specFor(status: string): StatusSpec {
  return STATUS_TABLE[status.toLowerCase()] ?? NEUTRAL;
}

export function sessionStatusGroup(status: string): SessionStatusGroup {
  return specFor(status).group;
}

export function canStart(status: string): boolean {
  return specFor(status).canStart;
}

export function canStop(status: string): boolean {
  return specFor(status).canStop;
}

export function canPause(status: string): boolean {
  return specFor(status).canPause;
}

export function canResume(status: string): boolean {
  return specFor(status).canResume;
}

export function statusColorClass(status: string): string {
  return specFor(status).colorClass;
}
