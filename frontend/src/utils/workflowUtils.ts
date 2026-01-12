/**
 * Workflow Utilities
 *
 * Helper functions for loading and managing workflows
 */

import { useBlockStore } from '../store/blockStore';
import { EXAMPLE_WORKFLOWS } from '../data/exampleWorkflows';
import type { Block } from '../types/block.types';

/**
 * Load an example workflow into the block store
 */
export function loadExampleWorkflow(workflowId: string): boolean {
  const workflow = EXAMPLE_WORKFLOWS.find((w) => w.id === workflowId);
  
  if (!workflow) {
    console.error(`Example workflow with ID "${workflowId}" not found`);
    return false;
  }

  // Clone the workflow to avoid modifying the original
  const clonedWorkflow = JSON.parse(JSON.stringify(workflow)) as Block;

  // Clear existing blocks and load the example
  const store = useBlockStore.getState();
  store.clear();
  store.addBlock(null, clonedWorkflow);

  return true;
}

/**
 * Get all available example workflows
 */
export function getExampleWorkflows(): Block[] {
  return EXAMPLE_WORKFLOWS;
}

/**
 * Create a new empty workflow
 */
export function createEmptyWorkflow(name: string = 'New Workflow'): Block {
  return {
    id: `workflow-${Date.now()}`,
    name,
    blockType: 'workflow',
    isAtomic: false,
    config: {
      type: 'workflow',
      description: '',
      version: '1.0.0',
    },
    inputs: [],
    outputs: [],
    position: { x: 0, y: 0 },
    children: [],
    connections: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user',
      description: '',
      tags: [],
      status: 'active',
    },
  };
}
