/**
 * Node type definitions
 * 
 * Represents different types of nodes in a workflow.
 */

export type NodeType = 'Agent' | 'Tool' | 'Decision' | 'Validator' | 'Trigger';

export type NodeStatus = 
  | 'Pending'
  | 'Running'
  | 'Completed'
  | 'Failed'
  | 'Skipped'
  | 'Cancelled';

/**
 * Base node interface
 */
export interface Node {
  id: string;
  name: string;
  type: NodeType;
  position: Position;
  config: Record<string, unknown>;
  status?: NodeStatus;
  inputs?: NodePort[];
  outputs?: NodePort[];
}

/**
 * Node position on canvas
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Node input/output port
 */
export interface NodePort {
  id: string;
  name: string;
  type: string;
  required?: boolean;
}

/**
 * Agent Node - Executes AI agent
 */
export interface AgentNode extends Node {
  type: 'Agent';
  config: AgentNodeConfig;
}

export interface AgentNodeConfig {
  agentType: 'Planner' | 'Coder' | 'Tester' | 'Reviewer' | 'Debugger';
  prompt?: string;
  tools?: string[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Tool Node - Executes bash/git/file operations
 */
export interface ToolNode extends Node {
  type: 'Tool';
  config: ToolNodeConfig;
}

export interface ToolNodeConfig {
  toolType: 'Bash' | 'Git' | 'FileSystem' | 'Custom';
  command?: string;
  script?: string;
  arguments?: string[];
  workingDirectory?: string;
}

/**
 * Decision Node - Conditional branching
 */
export interface DecisionNode extends Node {
  type: 'Decision';
  config: DecisionNodeConfig;
}

export interface DecisionNodeConfig {
  condition: string;
  trueOutput: string;
  falseOutput: string;
}

/**
 * Validator Node - Validates outputs
 */
export interface ValidatorNode extends Node {
  type: 'Validator';
  config: ValidatorNodeConfig;
}

export interface ValidatorNodeConfig {
  validationType: 'Schema' | 'Regex' | 'Custom';
  schema?: Record<string, unknown>;
  pattern?: string;
  validatorScript?: string;
}

/**
 * Trigger Node - Workflow trigger
 */
export interface TriggerNode extends Node {
  type: 'Trigger';
  config: TriggerNodeConfig;
}

export interface TriggerNodeConfig {
  triggerType: 'Manual' | 'Webhook' | 'Schedule' | 'FileWatch';
  webhookUrl?: string;
  cronExpression?: string;
  watchPath?: string;
}
