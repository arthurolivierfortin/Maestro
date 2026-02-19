/**
 * Real Execution Service
 *
 * Handles workflow execution with real backend API and SignalR real-time updates.
 */

import { apiClient } from './api';
import { signalRManager } from './signalr/SignalRManager';

/**
 * Execution options
 */
export interface ExecutionOptions {
  inputs?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  debug?: boolean;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  outputs?: Record<string, unknown>;
  error?: string;
}

/**
 * Execution status
 */
export interface ExecutionStatus {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  currentNodeId?: string;
  progress: number; // 0-100
  startedAt: string;
  completedAt?: string;
  outputs?: Record<string, unknown>;
  error?: string;
}

/**
 * Execution event callbacks
 */
export interface ExecutionCallbacks {
  onNodeStarted?: (data: { nodeId: string; nodeName: string; timestamp: string }) => void;
  onNodeCompleted?: (data: { nodeId: string; nodeName: string; outputs: any; timestamp: string }) => void;
  onNodeFailed?: (data: { nodeId: string; nodeName: string; error: string; timestamp: string }) => void;
  onExecutionCompleted?: (data: { executionId: string; outputs: any; timestamp: string }) => void;
  onExecutionFailed?: (data: { executionId: string; error: string; timestamp: string }) => void;
  onProgressUpdate?: (data: { executionId: string; progress: number; currentNode: string }) => void;
}

/**
 * Real Execution Service Implementation
 */
class RealExecutionServiceImpl {
  private readonly basePath = '/api/workflows';
  private readonly executionsPath = '/api/executions';

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    options?: ExecutionOptions
  ): Promise<ExecutionResult> {
    const response = await apiClient.post<ExecutionResult>(
      `${this.basePath}/${workflowId}/execute`,
      options || {}
    );
    return response;
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionStatus> {
    const response = await apiClient.get<ExecutionStatus>(
      `${this.executionsPath}/${executionId}/status`
    );
    return response;
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    await apiClient.post<void>(`${this.executionsPath}/${executionId}/cancel`, {});
  }

  /**
   * Pause a running execution
   */
  async pauseExecution(executionId: string): Promise<void> {
    await apiClient.post<void>(`${this.executionsPath}/${executionId}/pause`, {});
  }

  /**
   * Resume a paused execution
   */
  async resumeExecution(executionId: string): Promise<void> {
    await apiClient.post<void>(`${this.executionsPath}/${executionId}/resume`, {});
  }

  /**
   * Subscribe to real-time execution events via SignalR
   *
   * @param executionId - The execution ID to monitor
   * @param callbacks - Event callbacks
   * @returns Unsubscribe function
   */
  async subscribeToExecution(
    executionId: string,
    callbacks: ExecutionCallbacks
  ): Promise<(() => void) | null> {
    return signalRManager.subscribeToExecutionEvents(executionId, {
      onNodeStarted: callbacks.onNodeStarted,
      onNodeCompleted: callbacks.onNodeCompleted,
      onNodeFailed: callbacks.onNodeFailed,
      onExecutionCompleted: callbacks.onExecutionCompleted,
      onExecutionFailed: callbacks.onExecutionFailed,
      onProgressUpdate: callbacks.onProgressUpdate,
    });
  }

  /**
   * Get execution history for a workflow
   */
  async getExecutionHistory(workflowId: string, limit = 10): Promise<ExecutionResult[]> {
    const response = await apiClient.get<ExecutionResult[]>(
      `${this.basePath}/${workflowId}/executions`,
      { params: { limit } }
    );
    return response;
  }
}

/**
 * Singleton instance
 */
export const realExecutionService = new RealExecutionServiceImpl();
