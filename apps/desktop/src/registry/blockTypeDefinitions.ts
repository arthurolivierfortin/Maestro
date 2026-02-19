/**
 * Block Type Definitions
 *
 * Metadata definitions for all core block types.
 */

import type { BlockTypeInfo } from '../types/block-registry.types';
import type {
  TaskBlockConfig,
  CommandBlockConfig,
  PromptBlockConfig,
  InstructionBlockConfig,
  DecisionBlockConfig,
  ValidatorBlockConfig,
  TriggerBlockConfig,
  WorkflowBlockConfig,
  InferenceBlockConfig,
  ScriptBlockConfig,
  AgentBlockConfig,
  FoundryToolBlockConfig,
  ContextBlockConfig,
} from '../types/block.types';

/**
 * Workflow block type
 */
export const workflowTypeInfo: BlockTypeInfo = {
  type: 'workflow',
  label: 'Workflow',
  description: 'Top-level container for workflow blocks',
  icon: 'Workflow',
  color: '#2563eb',
  isAtomic: false,
  // Allow any block type inside a workflow
  allowedChildren: [
    'workflow',
    'task',
    'agent',
    'tool',
    'prompt',
    'instruction',
    'command',
    'decision',
    'validator',
    'trigger',
    'inference',
    'script',
    'context',
  ],
  allowedParents: [],
  defaultConfig: {
    type: 'workflow',
    description: '',
    version: '1.0.0',
    variables: [],
  } as WorkflowBlockConfig,
  defaultInputs: [],
  defaultOutputs: [],
};

/**
 * Task block type
 */
export const taskTypeInfo: BlockTypeInfo = {
  type: 'task',
  label: 'Task',
  description: 'Task with validation criteria',
  icon: 'ListChecks',
  color: '#10b981',
  isAtomic: false,
  allowedChildren: ['command', 'validator', 'decision', 'inference', 'script'],
  allowedParents: ['workflow'],
  defaultConfig: {
    type: 'task',
    description: '',
    successCriteria: [],
    maxRetries: 3,
    timeout: 300,
  } as TaskBlockConfig,
  defaultInputs: [
    {
      id: 'input',
      name: 'Input',
      dataType: 'any',
      required: false,
      multiple: false,
    },
  ],
  defaultOutputs: [
    {
      id: 'output',
      name: 'Output',
      dataType: 'any',
      required: false,
      multiple: false,
    },
  ],
};

/**
 * Agent block type - autonomous orchestrator
 */
export const agentTypeInfo: BlockTypeInfo = {
  type: 'agent',
  label: 'Agent',
  description: 'Autonomous orchestrator using tools',
  icon: 'Bot',
  color: '#7c3aed',
  isAtomic: false, // COMPOSITE - can contain children
  allowedChildren: ['inference', 'decision', 'prompt', 'validator', 'script', 'tool', 'context'],
  allowedParents: ['workflow'],
  defaultConfig: {
    type: 'agent',
    maxSteps: 50,
    temperature: 0.7,
    tools: [],
  } as AgentBlockConfig,
  defaultInputs: [
    {
      id: 'goal',
      name: 'Goal',
      dataType: 'string',
      required: true,
      multiple: false,
    },
  ],
  defaultOutputs: [
    {
      id: 'result',
      name: 'Result',
      dataType: 'any',
      required: false,
      multiple: false,
    },
  ],
};

/**
 * Tool block type - reusable capability with strict I/O
 */
export const toolTypeInfo: BlockTypeInfo = {
  type: 'tool',
  label: 'Tool',
  description: 'Reusable capability with strict I/O',
  icon: 'Wrench',
  color: '#0891b2',
  isAtomic: false, // COMPOSITE - can contain children
  allowedChildren: ['command', 'inference', 'validator', 'script', 'prompt'],
  allowedParents: ['workflow', 'agent'],
  defaultConfig: {
    type: 'tool',
    inputSchema: {},
    outputSchema: {},
  } as FoundryToolBlockConfig,
  defaultInputs: [
    {
      id: 'input',
      name: 'Input',
      dataType: 'any',
      required: true,
      multiple: false,
    },
  ],
  defaultOutputs: [
    {
      id: 'output',
      name: 'Output',
      dataType: 'any',
      required: true,
      multiple: false,
    },
  ],
};

/**
 * Prompt block type
 */
export const promptTypeInfo: BlockTypeInfo = {
  type: 'prompt',
  label: 'Prompt',
  description: 'Reusable prompt template',
  icon: 'MessageSquare',
  color: '#f59e0b',
  isAtomic: true,
  allowedChildren: [],
  allowedParents: ['workflow', 'task', 'inference'],
  defaultConfig: {
    type: 'prompt',
    template: '',
    variables: [],
  } as PromptBlockConfig,
  defaultInputs: [],
  defaultOutputs: [
    {
      id: 'prompt',
      name: 'Prompt',
      dataType: 'string',
      required: true,
      multiple: false,
    },
  ],
};

/**
 * Instruction block type
 */
export const instructionTypeInfo: BlockTypeInfo = {
  type: 'instruction',
  label: 'Instruction',
  description: 'Instruction file reference',
  icon: 'FileText',
  color: '#f97316',
  isAtomic: true,
  allowedChildren: [],
  allowedParents: ['workflow', 'task', 'inference'],
  defaultConfig: {
    type: 'instruction',
    filePath: '',
  } as InstructionBlockConfig,
  defaultInputs: [],
  defaultOutputs: [
    {
      id: 'content',
      name: 'Content',
      dataType: 'string',
      required: true,
      multiple: false,
    },
  ],
};

/**
 * Command block type (formerly 'tool')
 * Renamed to avoid confusion with AgentFoundry Tools
 */
export const commandTypeInfo: BlockTypeInfo = {
  type: 'command',
  label: 'Command',
  description: 'Executable command (bash, git, file ops)',
  icon: 'Terminal',
  color: '#6b7280',
  isAtomic: true,
  allowedChildren: [],
  allowedParents: ['workflow', 'task'],
  defaultConfig: {
    type: 'command',
    commandType: 'Bash',
    command: '',
    arguments: [],
  } as CommandBlockConfig,
  defaultInputs: [
    {
      id: 'input',
      name: 'Input',
      dataType: 'any',
      required: false,
      multiple: false,
    },
  ],
  defaultOutputs: [
    {
      id: 'output',
      name: 'Output',
      dataType: 'string',
      required: false,
      multiple: false,
    },
  ],
};

/**
 * Decision block type
 */
export const decisionTypeInfo: BlockTypeInfo = {
  type: 'decision',
  label: 'Decision',
  description: 'Conditional branching',
  icon: 'GitBranch',
  color: '#06b6d4',
  isAtomic: true,
  allowedChildren: [],
  allowedParents: ['workflow', 'task'],
  defaultConfig: {
    type: 'decision',
    condition: '',
    trueLabel: 'True',
    falseLabel: 'False',
  } as DecisionBlockConfig,
  defaultInputs: [
    {
      id: 'input',
      name: 'Input',
      dataType: 'any',
      required: true,
      multiple: false,
    },
  ],
  defaultOutputs: [
    {
      id: 'true',
      name: 'True',
      dataType: 'any',
      required: false,
      multiple: false,
    },
    {
      id: 'false',
      name: 'False',
      dataType: 'any',
      required: false,
      multiple: false,
    },
  ],
};

/**
 * Validator block type
 */
export const validatorTypeInfo: BlockTypeInfo = {
  type: 'validator',
  label: 'Validator',
  description: 'Output validation',
  icon: 'ShieldCheck',
  color: '#ec4899',
  isAtomic: true,
  allowedChildren: [],
  allowedParents: ['workflow', 'task'],
  defaultConfig: {
    type: 'validator',
    validationType: 'Schema',
  } as ValidatorBlockConfig,
  defaultInputs: [
    {
      id: 'input',
      name: 'Input',
      dataType: 'any',
      required: true,
      multiple: false,
    },
  ],
  defaultOutputs: [
    {
      id: 'valid',
      name: 'Valid',
      dataType: 'boolean',
      required: true,
      multiple: false,
    },
    {
      id: 'errors',
      name: 'Errors',
      dataType: 'array',
      required: false,
      multiple: false,
    },
  ],
};

/**
 * Trigger block type
 */
export const triggerTypeInfo: BlockTypeInfo = {
  type: 'trigger',
  label: 'Trigger',
  description: 'Workflow trigger',
  icon: 'Zap',
  color: '#ef4444',
  isAtomic: true,
  allowedChildren: [],
  allowedParents: ['workflow'],
  defaultConfig: {
    type: 'trigger',
    triggerType: 'Manual',
  } as TriggerBlockConfig,
  defaultInputs: [],
  defaultOutputs: [
    {
      id: 'event',
      name: 'Event',
      dataType: 'object',
      required: false,
      multiple: false,
    },
  ],
};

/**
 * Inference Unit block type
 */
export const inferenceTypeInfo: BlockTypeInfo = {
  type: 'inference',
  label: 'Inference Unit',
  description: 'Low-level LLM call with dynamic I/O for meta-optimization',
  icon: 'Brain',
  color: '#8b5cf6',
  isAtomic: true,
  allowedChildren: [],
  allowedParents: ['workflow', 'task'],
  defaultConfig: {
    type: 'inference',
    systemPrompt: '',
    userPrompt: '',
    inputs: [],
    outputSchema: '',
    temperature: 0.7,
    maxTokens: 1000,
    responseFormat: 'text',
  } as InferenceBlockConfig,
  defaultInputs: [], // Note: Inputs are dynamic based on config.inputs
  defaultOutputs: [
    {
      id: 'raw_response',
      name: 'Raw Response',
      dataType: 'string',
      required: true,
      multiple: false,
    },
    {
      id: 'metadata',
      name: 'Metadata',
      dataType: 'object',
      required: true,
      multiple: false,
    },
  ],
};

/**
 * Script block type
 */
export const scriptTypeInfo: BlockTypeInfo = {
  type: 'script',
  label: 'Script',
  description: 'Execute user-provided scripts (various languages)',
  icon: 'Code',
  color: '#f43f5e',
  isAtomic: true,
  allowedChildren: [],
  allowedParents: ['workflow', 'task'],
  defaultConfig: {
    type: 'script',
    language: 'javascript',
    code: '// write your script here',
    runInSandbox: true,
    timeoutSeconds: 30,
  } as ScriptBlockConfig,
  defaultInputs: [
    {
      id: 'input',
      name: 'Input',
      dataType: 'any',
      required: false,
      multiple: false,
    },
  ],
  defaultOutputs: [
    {
      id: 'output',
      name: 'Output',
      dataType: 'any',
      required: false,
      multiple: false,
    },
  ],
};

/**
 * Context block type - manages conversation context for LLM calls
 */
export const contextTypeInfo: BlockTypeInfo = {
  type: 'context',
  label: 'Context',
  description: 'Manages conversation context using sliding window or other strategies',
  icon: 'History',
  color: '#14b8a6',
  isAtomic: true,
  allowedChildren: [],
  allowedParents: ['workflow', 'agent'],
  defaultConfig: {
    type: 'context',
    strategy: 'sliding-window',
    maxTokens: 4096,
    reserveForResponse: 512,
    keepSystemPrompt: true,
    keepLastN: 10,
  } as ContextBlockConfig,
  defaultInputs: [
    {
      id: 'messages',
      name: 'Messages',
      dataType: 'array',
      required: true,
      multiple: false,
    },
    {
      id: 'systemPrompt',
      name: 'System Prompt',
      dataType: 'string',
      required: false,
      multiple: false,
    },
    {
      id: 'newMessage',
      name: 'New Message',
      dataType: 'string',
      required: false,
      multiple: false,
    },
  ],
  defaultOutputs: [
    {
      id: 'messages',
      name: 'Optimized Messages',
      dataType: 'array',
      required: true,
      multiple: false,
    },
    {
      id: 'estimatedTokens',
      name: 'Estimated Tokens',
      dataType: 'number',
      required: true,
      multiple: false,
    },
    {
      id: 'wasTruncated',
      name: 'Was Truncated',
      dataType: 'boolean',
      required: true,
      multiple: false,
    },
  ],
};

/**
 * All block type definitions
 */
export const blockTypeDefinitions: BlockTypeInfo[] = [
  workflowTypeInfo,
  taskTypeInfo,
  agentTypeInfo,
  toolTypeInfo,
  promptTypeInfo,
  instructionTypeInfo,
  commandTypeInfo,
  decisionTypeInfo,
  validatorTypeInfo,
  triggerTypeInfo,
  inferenceTypeInfo,
  scriptTypeInfo,
  contextTypeInfo,
];
