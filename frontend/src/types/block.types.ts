/**
 * Block Type Definitions
 *
 * Core block interface supporting recursive composition.
 * This is the foundation of the visual workflow editor.
 */

/**
 * Core block types - hardcoded for MVP
 */
export type BlockType =
  | 'workflow' // Top-level container
  | 'agent' // AI agent (can contain prompts, instructions, sub-agents)
  | 'task' // Task with validation (contains agents, validators)
  | 'prompt' // Reusable prompt template (atomic)
  | 'instruction' // Instruction file reference (atomic)
  | 'tool' // Executable tool (atomic)
  | 'decision' // Conditional branching (atomic)
  | 'validator' // Output validation (atomic)
  | 'trigger' // Workflow trigger (atomic)
  | 'inference'; // LLM inference unit with dynamic inputs/outputs (atomic)

/**
 * Input/Output port for block connections
 */
export interface Port {
  id: string;
  name: string;
  dataType: string; // e.g., "string", "object", "any"
  required: boolean;
  multiple: boolean; // Can accept multiple connections
}

/**
 * Position on canvas
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Connection between blocks
 */
export interface BlockConnection {
  id: string;
  sourceBlockId: string;
  sourcePortId: string;
  targetBlockId: string;
  targetPortId: string;
  label?: string;
}

/**
 * Block status
 */
export type BlockStatus = 'draft' | 'active' | 'archived';

/**
 * Block metadata
 */
export interface BlockMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  description?: string;
  tags: string[];
  version?: string;
  status: BlockStatus;
}

/**
 * Base Block interface - supports recursive composition
 */
export interface Block<TConfig = BlockConfig> {
  // Identity
  id: string;
  name: string;
  blockType: BlockType;

  // Composition
  isAtomic: boolean; // true = leaf node, false = can contain children
  children?: Block[];
  parentId?: string | null; // Parent block ID (null for root)

  // Configuration
  config: TConfig;
  inputs: Port[];
  outputs: Port[];

  // Capabilities (for filtering/discovery)
  capabilities?: string[]; // e.g., ["code-generation", "file-ops"]

  // Connections (for composite blocks containing a canvas)
  connections?: BlockConnection[];

  // Visual
  position: Position;

  // User preferences
  isFavorite?: boolean; // Starred/favorited by user

  // Metadata
  metadata: BlockMetadata;
}

/**
 * Base config type - all configs extend this
 */
export type BlockConfig =
  | AgentBlockConfig
  | TaskBlockConfig
  | ToolBlockConfig
  | PromptBlockConfig
  | InstructionBlockConfig
  | DecisionBlockConfig
  | ValidatorBlockConfig
  | TriggerBlockConfig
  | WorkflowBlockConfig
  | InferenceBlockConfig;

/**
 * Workflow block configuration (top-level container)
 */
export interface WorkflowBlockConfig {
  type: 'workflow';
  description?: string;
  version?: string;
  variables?: WorkflowVariable[];
}

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  value: unknown;
  description?: string;
}

/**
 * Agent block configuration
 */
export interface AgentBlockConfig {
  type: 'agent';
  agentType: 'Planner' | 'Coder' | 'Tester' | 'Reviewer' | 'Debugger' | 'Custom';
  model?: string; // Legacy: Model name string (deprecated, use modelId)
  modelId?: string; // Primary model ID from model registry
  fallbackModelId?: string; // Fallback model if primary is unavailable
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: string[]; // Tool IDs this agent can use
}

/**
 * Task block configuration
 */
export interface TaskBlockConfig {
  type: 'task';
  description: string;
  successCriteria?: string[];
  maxRetries?: number;
  timeout?: number; // seconds
}

/**
 * Tool block configuration
 */
export interface ToolBlockConfig {
  type: 'tool';
  toolType: 'Bash' | 'Git' | 'FileSystem' | 'HTTP' | 'Custom';
  command?: string;
  script?: string;
  arguments?: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
}

/**
 * Prompt block configuration
 */
export interface PromptBlockConfig {
  type: 'prompt';
  template: string; // Prompt template with {{variables}}
  variables?: PromptVariable[];
}

export interface PromptVariable {
  name: string;
  type: string;
  defaultValue?: string;
  description?: string;
}

/**
 * Instruction block configuration
 */
export interface InstructionBlockConfig {
  type: 'instruction';
  filePath: string; // Path to instruction file
  content?: string; // Optional cached content
}

/**
 * Decision block configuration
 */
export interface DecisionBlockConfig {
  type: 'decision';
  condition: string; // JavaScript expression
  trueLabel?: string;
  falseLabel?: string;
}

/**
 * Validator block configuration
 */
export interface ValidatorBlockConfig {
  type: 'validator';
  validationType: 'Schema' | 'Regex' | 'LLM' | 'Custom';
  schema?: object; // JSON Schema
  pattern?: string; // Regex pattern
  llmPrompt?: string; // LLM-based validation prompt
  customScript?: string;
}

/**
 * Trigger block configuration
 */
export interface TriggerBlockConfig {
  type: 'trigger';
  triggerType: 'Manual' | 'Webhook' | 'Schedule' | 'FileWatch' | 'Event';
  webhookPath?: string;
  cronExpression?: string;
  watchPath?: string;
  eventName?: string;
}

/**
 * Dynamic parameter for inference unit
 */
export interface InferenceParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required: boolean;
  defaultValue?: unknown;
}

/**
 * Structured output extraction (optional)
 */
export interface InferenceOutput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  jsonPath?: string; // JSONPath expression to extract from response
  regex?: string; // Regex pattern to extract from response
}

/**
 * Inference Unit block configuration
 * Low-level LLM call with dynamic inputs/outputs
 */
export interface InferenceBlockConfig {
  type: 'inference';
  
  // Prompts
  systemPrompt?: string;
  userPrompt: string; // Can use {{parameterName}} for dynamic parameters
  
  // Dynamic inputs
  inputs: InferenceParameter[];
  
  // Structured outputs (optional extractions)
  // Note: raw_response and metadata outputs are always available automatically
  structuredOutputs?: InferenceOutput[];
  
  // LLM configuration
  modelId?: string; // Model ID from model registry
  fallbackModelId?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  responseFormat?: 'text' | 'json' | 'yaml';
  stopSequences?: string[];
}

/**
 * Type guards for block configs
 */
export function isAgentConfig(config: BlockConfig): config is AgentBlockConfig {
  return config.type === 'agent';
}

export function isTaskConfig(config: BlockConfig): config is TaskBlockConfig {
  return config.type === 'task';
}

export function isToolConfig(config: BlockConfig): config is ToolBlockConfig {
  return config.type === 'tool';
}

export function isPromptConfig(config: BlockConfig): config is PromptBlockConfig {
  return config.type === 'prompt';
}

export function isInstructionConfig(config: BlockConfig): config is InstructionBlockConfig {
  return config.type === 'instruction';
}

export function isDecisionConfig(config: BlockConfig): config is DecisionBlockConfig {
  return config.type === 'decision';
}

export function isValidatorConfig(config: BlockConfig): config is ValidatorBlockConfig {
  return config.type === 'validator';
}

export function isTriggerConfig(config: BlockConfig): config is TriggerBlockConfig {
  return config.type === 'trigger';
}

export function isWorkflowConfig(config: BlockConfig): config is WorkflowBlockConfig {
  return config.type === 'workflow';
}

export function isInferenceConfig(config: BlockConfig): config is InferenceBlockConfig {
  return config.type === 'inference';
}
