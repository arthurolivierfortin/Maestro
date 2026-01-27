/**
 * Execution Service
 *
 * Provides functions for executing blocks and workflows via the backend API.
 */

import { apiClient } from './api';

// ============= Types =============

export interface BlockExecutionRequest {
  inputs?: Record<string, unknown>;
  workingDirectory?: string;
}

export interface BlockExecutionResult {
  success: boolean;
  outputs?: Record<string, unknown>;
  logs?: string[];
  durationMs?: number;
  error?: string;
}

export interface WorkflowExecutionRequest {
  inputs?: Record<string, unknown>;
  workingDirectory?: string;
}

export interface WorkflowExecutionResult {
  success: boolean;
  outputs?: Record<string, unknown>;
  error?: string;
}

// ============= Service Functions =============

/**
 * Execute a single block by ID.
 */
export async function executeBlock(
  blockId: string,
  request: BlockExecutionRequest = {}
): Promise<BlockExecutionResult> {
  return apiClient.post<BlockExecutionResult>(`/api/blocks/${blockId}/execute`, request);
}

/**
 * Execute a workflow by ID.
 */
export async function executeWorkflow(
  workflowId: string,
  request: WorkflowExecutionRequest = {}
): Promise<WorkflowExecutionResult> {
  return apiClient.post<WorkflowExecutionResult>(`/api/workflows/${workflowId}/execute`, request);
}

/**
 * Get list of workflow blocks.
 */
export async function getWorkflowBlocks() {
  return apiClient.get<unknown[]>('/api/workflows/blocks');
}

// ============= Export =============

export const executionService = {
  executeBlock,
  executeWorkflow,
  getWorkflowBlocks,
};

export default executionService;
