import type { HttpTransport } from '../http.js';
import type { WorkflowExecuteOptions, ExecutionStatus } from '../types.js';

export function workflowDomain(http: HttpTransport) {
  return {
    execute: (id: string, options: WorkflowExecuteOptions = {}) =>
      http.post<ExecutionStatus>(`/api/workflows/${id}/execute`, options),

    executionStatus: (executionId: string) =>
      http.get<ExecutionStatus>(`/api/executions/${executionId}`),

    cancelExecution: (executionId: string) =>
      http.post(`/api/executions/${executionId}/cancel`),
  };
}
