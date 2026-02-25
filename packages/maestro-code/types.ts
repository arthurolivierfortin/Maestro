/**
 * Maestro Code — Shared types for the agent-first TUI application.
 */

// ── Screen types (navigation targets) ───────────────────────────

export type Screen =
  | { type: 'agent' }
  | { type: 'catalog' }
  | { type: 'sessions' }
  | { type: 'models' }
  | { type: 'block-detail'; id: string }
  | { type: 'session-detail'; id: string }
  | { type: 'model-detail'; id: string }
  | { type: 'workspace-detail'; id: string }
  | { type: 'repo-detail'; id: string }
  | { type: 'welcome' }
  | { type: 'help' };

// ── Agent state ─────────────────────────────────────────────────

export type AgentState = 'idle' | 'working' | 'navigating' | 'waiting-input' | 'error' | 'thinking';

// ── Log line (used by OutputPanel and AgentScreen) ──────────────

export interface LogLine {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
  timestamp?: string;
}

// ── Widget (used by WidgetRenderer) ─────────────────────────────

export interface Widget {
  type: string;
  content: string;
  params: Record<string, any>;
  id: string;
  interactive?: boolean;
  timestamp?: string;
}

// ── Screen comparison helper ────────────────────────────────────

export function screenEquals(a: Screen, b: Screen): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'block-detail' && b.type === 'block-detail') return a.id === b.id;
  if (a.type === 'session-detail' && b.type === 'session-detail') return a.id === b.id;
  if (a.type === 'model-detail' && b.type === 'model-detail') return a.id === b.id;
  if (a.type === 'workspace-detail' && b.type === 'workspace-detail') return a.id === b.id;
  if (a.type === 'repo-detail' && b.type === 'repo-detail') return a.id === b.id;
  return true;
}

