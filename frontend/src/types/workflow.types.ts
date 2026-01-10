/**
 * Workflow type definitions
 * 
 * Core workflow structure matching backend domain model.
 */

import { Node } from './node.types';

/**
 * Complete workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: Node[];
  connections: Connection[];
  variables?: WorkflowVariable[];
  metadata: WorkflowMetadata;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * Node connection
 */
export interface Connection {
  id: string;
  from: string;
  to: string;
  fromOutput?: string;
  toInput?: string;
  condition?: string;
}

/**
 * Workflow variable
 */
export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  value: unknown;
  description?: string;
}

/**
 * Workflow metadata
 */
export interface WorkflowMetadata {
  tags: string[];
  category?: string;
  author: string;
  isPublic: boolean;
  executionCount: number;
  lastExecutedAt?: string;
}

/**
 * Workflow summary (for list views)
 */
export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodeCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastExecutedAt?: string;
  executionCount: number;
}

/**
 * Workflow DTO for create/update operations
 */
export interface WorkflowDto {
  name: string;
  description?: string;
  nodes: Node[];
  connections: Connection[];
  variables?: WorkflowVariable[];
  tags?: string[];
  isPublic?: boolean;
}

/**
 * Workflow validation result
 */
export interface WorkflowValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
  connectionId?: string;
}

export interface ValidationWarning {
  message: string;
  nodeId?: string;
}

/**
 * Workflow template
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  workflow: WorkflowDto;
  preview: string;
  downloads: number;
}
