/**
 * Example Workflows
 *
 * Pre-built workflow examples demonstrating various features
 */

import type { Block } from '../types/block.types';

/**
 * Example 1: Commit Description Generator
 *
 * A workflow that generates git commit messages from staged changes
 */
export const COMMIT_DESCRIPTION_WORKFLOW: Block = {
  id: 'workflow-commit-desc',
  name: 'Commit Description Generator',
  blockType: 'workflow',
  isAtomic: false,
  config: {
    type: 'workflow',
    description: 'Generates conventional commit messages from git diff',
    version: '1.0.0',
  },
  inputs: [],
  outputs: [
    {
      id: 'output',
      name: 'Commit Message',
      dataType: 'string',
      required: false,
      multiple: false,
    },
  ],
  position: { x: 0, y: 0 },
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
    description: 'Generates conventional commit messages from git diff',
    tags: ['git', 'commit', 'automation', 'example'],
    status: 'active',
  },
  children: [
    {
      id: 'trigger-manual-1',
      name: 'Manual Trigger',
      blockType: 'trigger',
      isAtomic: true,
      config: {
        type: 'trigger',
        triggerType: 'Manual',
      },
      inputs: [],
      outputs: [
        {
          id: 'output',
          name: 'Trigger',
          dataType: 'event',
          required: false,
          multiple: false,
        },
      ],
      position: { x: 50, y: 200 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        description: 'Start the workflow manually',
        tags: [],
        status: 'active',
      },
    },
    {
      id: 'command-git-diff-1',
      name: 'Get Staged Changes',
      blockType: 'command',
      isAtomic: true,
      config: {
        type: 'command',
        commandType: 'Git',
        command: 'git diff --staged',
      },
      inputs: [
        {
          id: 'input',
          name: 'Trigger',
          dataType: 'event',
          required: true,
          multiple: false,
        },
      ],
      outputs: [
        {
          id: 'output',
          name: 'Diff Output',
          dataType: 'string',
          required: false,
          multiple: false,
        },
      ],
      position: { x: 300, y: 200 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        description: 'Retrieve git diff of staged changes',
        tags: ['git'],
        status: 'active',
      },
    },
    {
      id: 'inference-describer-1',
      name: 'Generate Description',
      blockType: 'inference',
      isAtomic: true,
      config: {
        type: 'inference',
        systemPrompt:
          'You are a helpful assistant that writes clear, concise git commit messages following conventional commits format (feat|fix|docs|style|refactor|test|chore). Analyze the git diff and generate an appropriate commit message.',
        userPrompt: 'Generate a commit message for the following git diff:\n\n{{gitDiff}}',
        inputs: [{ name: 'gitDiff', type: 'string', required: true, description: 'Git diff output' }],
        modelId: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 200,
        responseFormat: 'text',
      },
      inputs: [
        {
          id: 'input',
          name: 'Git Diff',
          dataType: 'string',
          required: true,
          multiple: false,
        },
      ],
      outputs: [
        {
          id: 'raw_response',
          name: 'Commit Message',
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
      position: { x: 550, y: 200 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        description: 'LLM inference that generates commit messages',
        tags: ['ai', 'llm'],
        status: 'active',
      },
    },
    {
      id: 'validator-format-1',
      name: 'Validate Format',
      blockType: 'validator',
      isAtomic: true,
      config: {
        type: 'validator',
        validationType: 'Regex',
        pattern: '^(feat|fix|docs|style|refactor|test|chore)(\\(.+\\))?: .+$',
      },
      inputs: [
        {
          id: 'input',
          name: 'Commit Message',
          dataType: 'string',
          required: true,
          multiple: false,
        },
      ],
      outputs: [
        {
          id: 'output',
          name: 'Valid Message',
          dataType: 'string',
          required: false,
          multiple: false,
        },
        {
          id: 'error',
          name: 'Error',
          dataType: 'error',
          required: false,
          multiple: false,
        },
      ],
      position: { x: 800, y: 200 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        description: 'Validates conventional commit format',
        tags: ['validation'],
        status: 'active',
      },
    },
  ],
  connections: [
    {
      id: 'conn-1',
      sourceBlockId: 'trigger-manual-1',
      sourcePortId: 'output',
      targetBlockId: 'command-git-diff-1',
      targetPortId: 'input',
    },
    {
      id: 'conn-2',
      sourceBlockId: 'command-git-diff-1',
      sourcePortId: 'output',
      targetBlockId: 'inference-describer-1',
      targetPortId: 'input',
    },
    {
      id: 'conn-3',
      sourceBlockId: 'inference-describer-1',
      sourcePortId: 'raw_response',
      targetBlockId: 'validator-format-1',
      targetPortId: 'input',
    },
  ],
};

/**
 * Example 2: Simple Hello World
 *
 * A minimal workflow demonstrating basic agent usage
 */
export const HELLO_WORLD_WORKFLOW: Block = {
  id: 'workflow-hello-world',
  name: 'Hello World',
  blockType: 'workflow',
  isAtomic: false,
  config: {
    type: 'workflow',
    description: 'A simple greeting workflow',
    version: '1.0.0',
  },
  inputs: [],
  outputs: [
    {
      id: 'output',
      name: 'Greeting',
      dataType: 'string',
      required: false,
      multiple: false,
    },
  ],
  position: { x: 0, y: 0 },
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
    description: 'A simple greeting workflow',
    tags: ['example', 'tutorial'],
    status: 'active',
  },
  children: [
    {
      id: 'inference-greeter-1',
      name: 'Greeter',
      blockType: 'inference',
      isAtomic: true,
      config: {
        type: 'inference',
        systemPrompt: 'You are a friendly assistant. Say hello to the user in a creative way.',
        userPrompt: 'Generate a friendly greeting.',
        inputs: [],
        modelId: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 50,
        responseFormat: 'text',
      },
      inputs: [],
      outputs: [
        {
          id: 'raw_response',
          name: 'Greeting',
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
      position: { x: 200, y: 200 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        description: 'Generates a friendly greeting',
        tags: ['ai'],
        status: 'active',
      },
    },
  ],
  connections: [],
};

/**
 * All example workflows
 */
export const EXAMPLE_WORKFLOWS = [COMMIT_DESCRIPTION_WORKFLOW, HELLO_WORLD_WORKFLOW];
