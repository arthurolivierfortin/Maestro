/**
 * Block Type Definitions
 *
 * Metadata definitions for all core block types.
 */

import type { BlockTypeInfo } from '../types/block-registry.types';
import type {
  AgentBlockConfig,
  TaskBlockConfig,
  ToolBlockConfig,
  PromptBlockConfig,
  InstructionBlockConfig,
  DecisionBlockConfig,
  ValidatorBlockConfig,
  TriggerBlockConfig,
  WorkflowBlockConfig,
  InferenceBlockConfig,
  ScriptBlockConfig,
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
    'agent',
    'task',
    'prompt',
    'instruction',
    'tool',
    'decision',
    'validator',
    'trigger',
    'inference',
    'script',
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
 * Agent block type
 */
export const agentTypeInfo: BlockTypeInfo = {
  type: 'agent',
  label: 'Agent',
  description: 'AI agent that can execute tasks',
  icon: 'Bot',
  color: '#7c3aed',
  isAtomic: false,
  allowedChildren: ['prompt', 'instruction', 'tool'],
  allowedParents: ['workflow', 'task'],
  defaultConfig: {
    type: 'agent',
    agentType: 'Custom',
    temperature: 0.7,
    maxTokens: 2000,
  } as AgentBlockConfig,
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
 * Task block type
 */
export const taskTypeInfo: BlockTypeInfo = {
  type: 'task',
  label: 'Task',
  description: 'Task with validation criteria',
  icon: 'ListChecks',
  color: '#10b981',
  isAtomic: false,
  allowedChildren: ['agent', 'tool', 'validator', 'decision'],
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
  allowedParents: ['agent'],
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
  allowedParents: ['agent'],
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
 * Tool block type
 */
export const toolTypeInfo: BlockTypeInfo = {
  type: 'tool',
  label: 'Tool',
  description: 'Executable tool (bash, git, file ops)',
  icon: 'Terminal',
  color: '#6b7280',
  isAtomic: true,
  allowedChildren: [],
  allowedParents: ['workflow', 'task', 'agent'],
  defaultConfig: {
    type: 'tool',
    toolType: 'Bash',
    command: '',
    arguments: [],
  } as ToolBlockConfig,
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
  allowedParents: ['workflow', 'task', 'agent'],
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
  allowedParents: ['workflow', 'task', 'agent'],
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
 * All block type definitions
 */
export const blockTypeDefinitions: BlockTypeInfo[] = [
  workflowTypeInfo,
  agentTypeInfo,
  taskTypeInfo,
  promptTypeInfo,
  instructionTypeInfo,
  toolTypeInfo,
  decisionTypeInfo,
  validatorTypeInfo,
  triggerTypeInfo,
  inferenceTypeInfo,
  scriptTypeInfo,
];
