/**
 * Block Type Definitions
 *
 * Core block interface supporting recursive composition.
 * This is the foundation of the visual workflow editor.
 */

/**
 * Core block types - hardcoded for MVP
 * Note: 'agent' block type removed to avoid confusion with AgentFoundry Agents
 * Note: 'tool' renamed to 'command' to avoid confusion with AgentFoundry Tools
 */
export type BlockType =
  | 'workflow' // Top-level container
  | 'task' // Task with validation (contains validators, commands)
  | 'prompt' // Reusable prompt template (atomic)
  | 'instruction' // Instruction file reference (atomic)
  | 'command' // Executable command (bash, git, file ops) - formerly 'tool' (atomic)
  | 'decision' // Conditional branching (atomic)
  | 'validator' // Output validation (atomic)
  | 'trigger' // Workflow trigger (atomic)
  | 'inference' // LLM inference unit with dynamic inputs/outputs (atomic)
  | 'script'; // Script block to run user-provided code (atomic)

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
 * Note: AgentBlockConfig removed (use AgentFoundry Agents instead)
 * Note: ToolBlockConfig renamed to CommandBlockConfig
 */
export type BlockConfig =
  | TaskBlockConfig
  | CommandBlockConfig
  | PromptBlockConfig
  | InstructionBlockConfig
  | DecisionBlockConfig
  | ValidatorBlockConfig
  | TriggerBlockConfig
  | WorkflowBlockConfig
  | InferenceBlockConfig
  | ScriptBlockConfig;

/**
 * Script block configuration - allows storing code in any language
 */
export interface ScriptBlockConfig {
  type: 'script';
  language: string; // e.g., 'javascript', 'python', 'bash'
  code: string; // the source code to run
  runInSandbox?: boolean; // whether execution should be sandboxed
  timeoutSeconds?: number; // max execution time
}

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
 * Command block configuration (formerly ToolBlockConfig)
 * Renamed to avoid confusion with AgentFoundry Tools
 */
export interface CommandBlockConfig {
  type: 'command';
  commandType: 'Bash' | 'Git' | 'FileSystem' | 'HTTP' | 'Custom';
  command?: string;
  script?: string;
  arguments?: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
}

/**
 * @deprecated Use CommandBlockConfig instead. Alias for backward compatibility.
 */
export type ToolBlockConfig = CommandBlockConfig;

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
  
  // Output schema (added to prompt to guide structure)
  // Note: Only raw_response and metadata outputs are generated.
  // Use other blocks (Tool, Decision) to parse/extract from raw_response.
  outputSchema?: string; // JSON schema definition (added to prompt, no auto-parsing)
  
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
export function isTaskConfig(config: BlockConfig): config is TaskBlockConfig {
  return config.type === 'task';
}

export function isCommandConfig(config: BlockConfig): config is CommandBlockConfig {
  return config.type === 'command';
}

/**
 * @deprecated Use isCommandConfig instead. Alias for backward compatibility.
 */
export function isToolConfig(config: BlockConfig): config is CommandBlockConfig {
  return config.type === 'command';
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

export function isScriptConfig(config: BlockConfig): config is ScriptBlockConfig {
  return config.type === 'script';
}

/**
 * Check if inference config has output schema
 */
export function hasOutputSchema(config: InferenceBlockConfig): boolean {
  return !!(config.outputSchema && config.outputSchema.trim());
}
