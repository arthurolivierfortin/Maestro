/**
 * Workflow Service
 *
 * Handles all workflow-related API calls.
 */

import { apiClient } from './api';
import { config } from '../config';
import { getMockExecutionService } from './mock/mockExecutionService';
import type {
  Workflow,
  WorkflowSummary,
  WorkflowDto,
  WorkflowValidation,
  WorkflowExecution,
  ExecutionSummary,
  ExecutionFilters,
} from '../types';

/**
 * Workflow CRUD operations
 */
export const workflowService = {
  /**
   * Get all workflows
   */
  async getAll(): Promise<WorkflowSummary[]> {
    return apiClient.get<WorkflowSummary[]>('/api/workflows');
  },

  /**
   * Get workflow by ID
   */
  async getById(id: string): Promise<Workflow> {
    return apiClient.get<Workflow>(`/api/workflows/${id}`);
  },

  /**
   * Create new workflow
   */
  async create(workflow: WorkflowDto): Promise<Workflow> {
    return apiClient.post<Workflow>('/api/workflows', workflow);
  },

  /**
   * Update existing workflow
   */
  async update(id: string, workflow: WorkflowDto): Promise<Workflow> {
    return apiClient.put<Workflow>(`/api/workflows/${id}`, workflow);
  },

  /**
   * Delete workflow
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/workflows/${id}`);
  },

  /**
   * Validate workflow
   */
  async validate(id: string): Promise<WorkflowValidation> {
    return apiClient.post<WorkflowValidation>(`/api/workflows/${id}/validate`);
  },

  /**
   * Duplicate workflow
   */
  async duplicate(id: string, newName: string): Promise<Workflow> {
    return apiClient.post<Workflow>(`/api/workflows/${id}/duplicate`, { newName });
  },

  /**
   * Export workflow as JSON
   */
  async export(id: string): Promise<Blob> {
    const response = await fetch(`${apiClient}/api/workflows/${id}/export`);
    return response.blob();
  },

  /**
   * Import workflow from JSON
   */
  async import(file: File): Promise<Workflow> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<Workflow>('/api/workflows/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

/**
 * Workflow execution operations
 */
export const executionService = {
  /**
   * Execute workflow
   */
  async execute(workflowId: string): Promise<WorkflowExecution> {
    const useMock = config.useMockBackend();
    
    if (useMock) {
      const mockService = getMockExecutionService();
      return mockService.execute(workflowId);
    }
    
    return apiClient.post<WorkflowExecution>(`/api/workflows/${workflowId}/execute`);
  },

  /**
   * Get execution by ID
   */
  async getExecution(executionId: string): Promise<WorkflowExecution> {
    const useMock = config.useMockBackend();
    
    if (useMock) {
      const mockService = getMockExecutionService();
      return mockService.getExecution(executionId);
    }
    
    return apiClient.get<WorkflowExecution>(`/api/executions/${executionId}`);
  },

  /**
   * Pause execution
   */
  async pause(executionId: string): Promise<void> {
    const useMock = config.useMockBackend();
    
    if (useMock) {
      const mockService = getMockExecutionService();
      return mockService.pause(executionId);
    }
    
    return apiClient.post<void>(`/api/executions/${executionId}/pause`);
  },

  /**
   * Resume execution
   */
  async resume(executionId: string): Promise<void> {
    const useMock = config.useMockBackend();
    
    if (useMock) {
      const mockService = getMockExecutionService();
      return mockService.resume(executionId);
    }
    
    return apiClient.post<void>(`/api/executions/${executionId}/resume`);
  },

  /**
   * Cancel execution
   */
  async cancel(executionId: string): Promise<void> {
    const useMock = config.useMockBackend();
    
    if (useMock) {
      const mockService = getMockExecutionService();
      return mockService.cancel(executionId);
    }
    
    return apiClient.post<void>(`/api/executions/${executionId}/cancel`);
  },

  /**
   * Get execution history
   */
  async getHistory(filters?: ExecutionFilters): Promise<ExecutionSummary[]> {
    const useMock = config.useMockBackend();
    
    if (useMock) {
      const mockService = getMockExecutionService();
      return mockService.getHistory() as Promise<any>;
    }
    
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }
    return apiClient.get<ExecutionSummary[]>(`/api/executions?${params.toString()}`);
  },

  /**
   * Get execution logs
   */
  async getLogs(executionId: string): Promise<string> {
    const useMock = config.useMockBackend();
    
    if (useMock) {
      const mockService = getMockExecutionService();
      return mockService.getLogs(executionId);
    }
    
    return apiClient.get<string>(`/api/executions/${executionId}/logs`);
  },
};

export default {
  ...workflowService,
  execution: executionService,
};
