/**
 * Demo Blocks Data
 *
 * Sample blocks for demonstrating the Foundry page.
 * Phase 4f.2 - Foundry Page Foundation
 */

import type { Block } from '../types/block.types';

/**
 * Sample agent blocks
 */
export const sampleAgents: Block[] = [
  {
    id: 'agent-planner-001',
    name: 'Planner Agent',
    blockType: 'agent',
    isAtomic: false,
    config: {
      type: 'agent',
      agentType: 'Planner',
      modelId: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2000,
      systemPrompt: 'You are a planning agent that breaks down tasks into subtasks.',
    },
    inputs: [{ id: 'in1', name: 'task', dataType: 'string', required: true, multiple: false }],
    outputs: [{ id: 'out1', name: 'plan', dataType: 'object', required: true, multiple: false }],
    position: { x: 0, y: 0 },
    parentId: null,
    metadata: {
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
      createdBy: 'system',
      description: 'Breaks down complex tasks into manageable subtasks',
      tags: ['planning', 'ai', 'task-decomposition'],
      status: 'active',
    },
  },
  {
    id: 'agent-coder-001',
    name: 'Coder Agent',
    blockType: 'agent',
    isAtomic: false,
    config: {
      type: 'agent',
      agentType: 'Coder',
      modelId: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 4000,
      systemPrompt: 'You are a coding agent that writes clean, well-documented code.',
    },
    inputs: [{ id: 'in1', name: 'requirements', dataType: 'string', required: true, multiple: false }],
    outputs: [{ id: 'out1', name: 'code', dataType: 'string', required: true, multiple: false }],
    position: { x: 0, y: 0 },
    parentId: null,
    metadata: {
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
      createdBy: 'system',
      description: 'Generates code based on requirements',
      tags: ['coding', 'ai', 'code-generation'],
      status: 'active',
    },
  },
  {
    id: 'agent-reviewer-001',
    name: 'Code Reviewer',
    blockType: 'agent',
    isAtomic: false,
    config: {
      type: 'agent',
      agentType: 'Reviewer',
      modelId: 'claude-3-opus',
      temperature: 0.5,
      maxTokens: 3000,
      systemPrompt: 'You are a code reviewer that provides constructive feedback.',
    },
    inputs: [{ id: 'in1', name: 'code', dataType: 'string', required: true, multiple: false }],
    outputs: [{ id: 'out1', name: 'review', dataType: 'object', required: true, multiple: false }],
    position: { x: 0, y: 0 },
    parentId: null,
    metadata: {
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
      createdBy: 'system',
      description: 'Reviews code and provides feedback',
      tags: ['review', 'ai', 'quality-assurance'],
      status: 'active',
    },
  },
];

/**
 * Sample tool blocks
 */
export const sampleTools: Block[] = [
  {
    id: 'tool-bash-001',
    name: 'Bash Executor',
    blockType: 'tool',
    isAtomic: true,
    config: {
      type: 'tool',
      toolType: 'Bash',
      command: 'bash',
      workingDirectory: '/workspace',
    },
    inputs: [{ id: 'in1', name: 'command', dataType: 'string', required: true, multiple: false }],
    outputs: [
      { id: 'out1', name: 'stdout', dataType: 'string', required: false, multiple: false },
      { id: 'out2', name: 'stderr', dataType: 'string', required: false, multiple: false },
      { id: 'out3', name: 'exitCode', dataType: 'number', required: true, multiple: false },
    ],
    position: { x: 0, y: 0 },
    parentId: null,
    metadata: {
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
      createdBy: 'system',
      description: 'Executes bash commands',
      tags: ['bash', 'shell', 'cli', 'file-ops'],
      status: 'active',
    },
  },
  {
    id: 'tool-git-001',
    name: 'Git Operations',
    blockType: 'tool',
    isAtomic: true,
    config: {
      type: 'tool',
      toolType: 'Git',
    },
    inputs: [
      { id: 'in1', name: 'operation', dataType: 'string', required: true, multiple: false },
      { id: 'in2', name: 'args', dataType: 'array', required: false, multiple: false },
    ],
    outputs: [{ id: 'out1', name: 'result', dataType: 'object', required: true, multiple: false }],
    position: { x: 0, y: 0 },
    parentId: null,
    metadata: {
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
      createdBy: 'system',
      description: 'Performs Git operations',
      tags: ['git', 'vcs', 'git-ops'],
      status: 'active',
    },
  },
];

/**
 * Sample prompt blocks
 */
export const samplePrompts: Block[] = [
  {
    id: 'prompt-system-001',
    name: 'System Prompt Template',
    blockType: 'prompt',
    isAtomic: true,
    config: {
      type: 'prompt',
      template: 'You are {{role}}. {{instructions}}',
      variables: [
        { name: 'role', type: 'string', description: 'Agent role' },
        { name: 'instructions', type: 'string', description: 'Specific instructions' },
      ],
    },
    inputs: [],
    outputs: [{ id: 'out1', name: 'prompt', dataType: 'string', required: true, multiple: false }],
    position: { x: 0, y: 0 },
    parentId: null,
    metadata: {
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
      createdBy: 'system',
      description: 'Reusable system prompt template',
      tags: ['prompt', 'template'],
      status: 'active',
    },
  },
];

/**
 * Sample workflow blocks
 */
export const sampleWorkflows: Block[] = [
  {
    id: 'workflow-feature-001',
    name: 'Feature Development Pipeline',
    blockType: 'workflow',
    isAtomic: false,
    config: {
      type: 'workflow',
      description: 'Complete pipeline for developing a new feature',
      version: '1.0.0',
    },
    inputs: [{ id: 'in1', name: 'feature', dataType: 'string', required: true, multiple: false }],
    outputs: [{ id: 'out1', name: 'result', dataType: 'object', required: true, multiple: false }],
    position: { x: 0, y: 0 },
    parentId: null,
    children: [],
    connections: [],
    metadata: {
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
      createdBy: 'system',
      description: 'Automated feature development workflow',
      tags: ['workflow', 'development', 'automation'],
      status: 'active',
    },
  },
];

/**
 * Sample decision blocks
 */
export const sampleDecisions: Block[] = [
  {
    id: 'decision-tests-001',
    name: 'Tests Passed?',
    blockType: 'decision',
    isAtomic: true,
    config: {
      type: 'decision',
      condition: 'result.exitCode === 0',
      trueLabel: 'Success',
      falseLabel: 'Failed',
    },
    inputs: [{ id: 'in1', name: 'result', dataType: 'object', required: true, multiple: false }],
    outputs: [
      { id: 'out1', name: 'true', dataType: 'any', required: false, multiple: false },
      { id: 'out2', name: 'false', dataType: 'any', required: false, multiple: false },
    ],
    position: { x: 0, y: 0 },
    parentId: null,
    metadata: {
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
      createdBy: 'system',
      description: 'Checks if tests passed',
      tags: ['decision', 'testing'],
      status: 'active',
    },
  },
];

/**
 * All sample blocks
 */
export const allSampleBlocks: Block[] = [
  ...sampleAgents,
  ...sampleTools,
  ...samplePrompts,
  ...sampleWorkflows,
  ...sampleDecisions,
];
