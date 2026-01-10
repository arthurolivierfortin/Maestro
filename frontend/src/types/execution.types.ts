/**
 * Execution and monitoring type definitions
 * 
 * Real-time workflow execution tracking.
 */

export type ExecutionStatus = 
  | 'Pending'
  | 'Running'
  | 'Paused'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

/**
 * Workflow execution instance
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  triggeredBy: string;
  nodeExecutions: NodeExecution[];
  variables: Record<string, unknown>;
  error?: ExecutionError;
}

/**
 * Individual node execution
 */
export interface NodeExecution {
  id: string;
  nodeId: string;
  nodeName: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  logs: ExecutionLog[];
  error?: ExecutionError;
}

/**
 * Execution log entry
 */
export interface ExecutionLog {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  source: 'system' | 'agent' | 'tool';
  metadata?: Record<string, unknown>;
}

/**
 * Execution error
 */
export interface ExecutionError {
  code: string;
  message: string;
  details?: string;
  stackTrace?: string;
  timestamp: string;
}

/**
 * Execution event (SignalR)
 */
export type ExecutionEvent = 
  | ExecutionStartedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | NodeStartedEvent
  | NodeCompletedEvent
  | NodeFailedEvent
  | TerminalOutputEvent
  | ProgressUpdateEvent;

export interface BaseEvent {
  eventType: string;
  executionId: string;
  timestamp: string;
}

export interface ExecutionStartedEvent extends BaseEvent {
  eventType: 'ExecutionStarted';
  workflowId: string;
  workflowName: string;
}

export interface ExecutionCompletedEvent extends BaseEvent {
  eventType: 'ExecutionCompleted';
  duration: number;
  result: Record<string, unknown>;
}

export interface ExecutionFailedEvent extends BaseEvent {
  eventType: 'ExecutionFailed';
  error: ExecutionError;
}

export interface NodeStartedEvent extends BaseEvent {
  eventType: 'NodeStarted';
  nodeId: string;
  nodeName: string;
}

export interface NodeCompletedEvent extends BaseEvent {
  eventType: 'NodeCompleted';
  nodeId: string;
  nodeName: string;
  output: Record<string, unknown>;
  duration: number;
}

export interface NodeFailedEvent extends BaseEvent {
  eventType: 'NodeFailed';
  nodeId: string;
  nodeName: string;
  error: ExecutionError;
}

export interface TerminalOutputEvent extends BaseEvent {
  eventType: 'TerminalOutput';
  nodeId: string;
  output: string;
  stream: 'stdout' | 'stderr';
}

export interface ProgressUpdateEvent extends BaseEvent {
  eventType: 'ProgressUpdate';
  nodeId: string;
  percentage: number;
  message: string;
}

/**
 * Execution summary
 */
export interface ExecutionSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  nodeCount: number;
  completedNodes: number;
  failedNodes: number;
}

/**
 * Execution history filters
 */
export interface ExecutionFilters {
  workflowId?: string;
  status?: ExecutionStatus;
  startDate?: string;
  endDate?: string;
  triggeredBy?: string;
  limit?: number;
  offset?: number;
}
