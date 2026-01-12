/**
 * Mock Workflow Execution Service
 *
 * Simulates workflow execution without backend API
 */

import type {
  WorkflowExecution,
  NodeExecution,
  ExecutionStatus,
  ExecutionLog,
} from '../../types/execution.types';

/**
 * Delay helper for simulating async operations
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Random delay between min and max
 */
const randomDelay = (min: number, max: number) => {
  return delay(Math.floor(Math.random() * (max - min + 1)) + min);
};

/**
 * Generate mock execution result
 */
class MockExecutionService {
  private executions: Map<string, WorkflowExecution> = new Map();
  private executionCallbacks: Map<string, (execution: WorkflowExecution) => void> = new Map();

  /**
   * Execute a workflow
   */
  async execute(workflowId: string): Promise<WorkflowExecution> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date().toISOString();

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      workflowName: 'Mock Workflow',
      status: 'Running',
      startedAt: startTime,
      triggeredBy: 'user',
      nodeExecutions: [],
      variables: {},
    };

    this.executions.set(executionId, execution);

    // Simulate execution in background
    this.simulateExecution(execution);

    return execution;
  }

  /**
   * Get execution by ID
   */
  async getExecution(executionId: string): Promise<WorkflowExecution> {
    await randomDelay(50, 150);
    
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    
    return execution;
  }

  /**
   * Pause execution
   */
  async pause(executionId: string): Promise<void> {
    await randomDelay(50, 100);
    
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.status = 'Paused';
      this.notifyCallback(executionId, execution);
    }
  }

  /**
   * Resume execution
   */
  async resume(executionId: string): Promise<void> {
    await randomDelay(50, 100);
    
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.status = 'Running';
      this.notifyCallback(executionId, execution);
      // Continue simulation
      this.simulateExecution(execution);
    }
  }

  /**
   * Cancel execution
   */
  async cancel(executionId: string): Promise<void> {
    await randomDelay(50, 100);
    
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.status = 'Cancelled';
      execution.completedAt = new Date().toISOString();
      execution.duration = Date.now() - new Date(execution.startedAt).getTime();
      this.notifyCallback(executionId, execution);
    }
  }

  /**
   * Get execution history
   */
  async getHistory(): Promise<WorkflowExecution[]> {
    await randomDelay(100, 200);
    return Array.from(this.executions.values());
  }

  /**
   * Get execution logs
   */
  async getLogs(executionId: string): Promise<string> {
    await randomDelay(50, 100);
    
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    
    const logs = execution.nodeExecutions
      .flatMap((ne) => ne.logs)
      .map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    
    return logs || 'No logs available';
  }

  /**
   * Subscribe to execution updates
   */
  subscribe(executionId: string, callback: (execution: WorkflowExecution) => void) {
    this.executionCallbacks.set(executionId, callback);
  }

  /**
   * Unsubscribe from execution updates
   */
  unsubscribe(executionId: string) {
    this.executionCallbacks.delete(executionId);
  }

  /**
   * Notify callback of execution update
   */
  private notifyCallback(executionId: string, execution: WorkflowExecution) {
    const callback = this.executionCallbacks.get(executionId);
    if (callback) {
      callback(execution);
    }
  }

  /**
   * Simulate workflow execution
   */
  private async simulateExecution(execution: WorkflowExecution) {
    // Get number of nodes to simulate (default 3 if not specified)
    const nodeCount = execution.nodeExecutions.length || 3;
    
    // Initialize node executions if not present
    if (execution.nodeExecutions.length === 0) {
      for (let i = 0; i < nodeCount; i++) {
        const nodeExec: NodeExecution = {
          id: `node-exec-${i}`,
          nodeId: `node-${i}`,
          nodeName: `Node ${i + 1}`,
          status: 'Pending',
          startedAt: new Date().toISOString(),
          logs: [],
        };
        execution.nodeExecutions.push(nodeExec);
      }
    }

    // Execute nodes sequentially
    for (const nodeExec of execution.nodeExecutions) {
      // Check if paused or cancelled
      if (execution.status === 'Paused' || execution.status === 'Cancelled') {
        return;
      }

      // Start node execution
      nodeExec.status = 'Running';
      nodeExec.startedAt = new Date().toISOString();
      nodeExec.logs.push({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Starting ${nodeExec.nodeName}`,
        source: 'system',
      });
      
      this.notifyCallback(execution.id, { ...execution });

      // Simulate processing
      await randomDelay(500, 2000);

      // Check again after delay
      if (execution.status === 'Paused' || execution.status === 'Cancelled') {
        return;
      }

      // Complete node
      nodeExec.status = 'Completed';
      nodeExec.completedAt = new Date().toISOString();
      nodeExec.duration = Date.now() - new Date(nodeExec.startedAt).getTime();
      nodeExec.output = {
        result: 'Mock output',
        data: { success: true },
      };
      nodeExec.logs.push({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Completed ${nodeExec.nodeName}`,
        source: 'system',
      });

      this.notifyCallback(execution.id, { ...execution });
    }

    // Complete execution
    execution.status = 'Completed';
    execution.completedAt = new Date().toISOString();
    execution.duration = Date.now() - new Date(execution.startedAt).getTime();
    
    this.notifyCallback(execution.id, execution);
  }
}

// Singleton instance
let instance: MockExecutionService | null = null;

export function getMockExecutionService(): MockExecutionService {
  if (!instance) {
    instance = new MockExecutionService();
  }
  return instance;
}
