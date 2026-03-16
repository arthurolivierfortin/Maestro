/**
 * Session-related types — the API contract for session data.
 *
 * Shapes derived from backend DTOs and mock-api-client.js data constants.
 * Status strings use lowercase to match the API.
 */

export type SessionStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'paused'
  | 'error'
  | 'stopped';

export type PhaseStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'paused';

export type ExecutionNodeStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'error'
  | 'paused';

export type ExecutionNodeType =
  | 'tool'
  | 'inference'
  | 'validator'
  | 'decision'
  | 'script'
  | 'while'
  | 'for-each'
  | 'conditional'
  | 'phase'
  | 'workflow'
  | 'agent'
  | 'task'
  | 'prompt'
  | 'instruction'
  | 'trigger'
  | 'node';

export interface PhaseResult {
  iterations?: number;
  fitness?: number;
  tokenCount?: number;
}

export interface Phase {
  id: string;
  name: string;
  status: PhaseStatus;
  result?: PhaseResult;
}

export interface ExecutionNode {
  id: string;
  name: string;
  status: ExecutionNodeStatus;
  type: ExecutionNodeType;
  children: ExecutionNode[];
  startedAt?: string;
  completedAt?: string;
}

export type ExecutionTree = ExecutionNode[];

export interface CommandHistoryEntry {
  command: string;
  time: string;
  result?: string | null;
  status?: string;
}

export interface LLMActivityEntry {
  nodeId: string;
  time: string;
  duration: number;
  responseLength: number;
  promptPreview: string;
  responsePreview: string;
}

export interface ExecutionLogEntry {
  time: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
}

export interface Artifact {
  path: string;
  size: number;
  updatedAt: string;
}

export interface ActiveBlock {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface MonitorDescriptor {
  layout: string;
  title?: string;
}

export interface Widget {
  id: string;
  type: string;
  title?: string;
  dataPath?: string;
  config?: Record<string, unknown>;
}

export interface WorkflowConfig {
  [workflowId: string]: {
    [section: string]: {
      llm?: {
        systemPrompt?: string;
        model?: string;
        temperature?: number;
      };
      [key: string]: unknown;
    };
  };
}

export interface SessionVariables {
  _monitorDescriptor?: MonitorDescriptor;
  _phases?: Phase[];
  _executionTree?: ExecutionTree;
  _activeWorkflow?: string;
  _activeBlock?: ActiveBlock;
  _llmActivity?: LLMActivityEntry[];
  _executionLog?: ExecutionLogEntry[];
  _artifacts?: Artifact[];
  _workflowConfig?: WorkflowConfig;
  _commandLog?: CommandHistoryEntry[];
  _bestFitness?: number;
  _improvementPhases?: string[];
  [key: string]: unknown;
}

export interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  type?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  workingDirectory?: string;
  entryPoints?: Record<string, string>;
  commandHistory?: CommandHistoryEntry[];
  variables?: SessionVariables;
  monitorWidgets?: Widget[];
  parentSessionId?: string | null;
}
