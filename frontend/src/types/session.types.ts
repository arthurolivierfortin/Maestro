/**
 * Session Types - Generic execution unit
 * No domain-specific fields (training, pipeline, etc.)
 * Sessions are generic containers for block executions
 */

export type SessionStatus =
  | 'Pending'
  | 'Running'
  | 'Paused'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export type BlockExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface BlockExecution {
  blockId: string;
  blockName: string;
  blockType: string;
  status: BlockExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  retryCount: number;
  output?: unknown;
}

export interface SessionLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  blockId?: string;
  metadata?: Record<string, unknown>;
}

export interface Session {
  id: string;
  workspaceId: string;
  workspaceName: string;
  status: SessionStatus;

  // Generic execution info
  blocksTotal: number;
  blocksCompleted: number;
  currentBlockId?: string;
  currentBlockName?: string;

  // Block executions
  executions: BlockExecution[];

  // Timing
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;

  // Error info (if failed)
  error?: string;

  // Recent logs (for quick display)
  recentLogs: SessionLog[];

  // Optional metadata
  metadata?: Record<string, unknown>;
}

export interface SessionListFilters {
  workspaceId?: string;
  status?: SessionStatus;
  search?: string;
}

export interface CreateSessionRequest {
  workspaceId: string;
  entryBlockId?: string;
  config?: Record<string, unknown>;
}

export interface SessionSummary {
  id: string;
  workspaceId: string;
  workspaceName: string;
  status: SessionStatus;
  blocksTotal: number;
  blocksCompleted: number;
  currentBlockName?: string;
  duration?: number;
  createdAt: string;
  error?: string;
}
